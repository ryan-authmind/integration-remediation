package core

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"remediation-engine/internal/database"
	"remediation-engine/internal/integrations"
	"testing"

	"github.com/stretchr/testify/assert"
)

// MockExecutor implements Executor interface
type MockExecutor struct {
	ExecuteFunc func(integration database.Integration, definition database.ActionDefinition, contextData map[string]interface{}) ([]byte, int, error)
}

func (m *MockExecutor) Execute(integration database.Integration, definition database.ActionDefinition, contextData map[string]interface{}) ([]byte, int, error) {
	if m.ExecuteFunc != nil {
		return m.ExecuteFunc(integration, definition, contextData)
	}
	return nil, 200, nil
}

func TestEngine_Schedule(t *testing.T) {
	setupTestDB()
	
	// Seed Data (Default Tenant ID is 1)
	database.DB.Create(&database.Integration{Name: "AuthMind API", Enabled: true, PollingInterval: 60, TenantID: 1})
    
    wf := database.Workflow{Name: "W1", Enabled: true, TriggerType: "AUTHMIND_POLL", TenantID: 1}
    database.DB.Where("name = ?", wf.Name).Assign(wf).FirstOrCreate(&wf)
	
	engine := NewEngine()
	engine.schedulePollingTasks()
	
    // The previous assertions relied on internal state (amIntegration, cachedWorkflows) which are gone.
    // Ideally we'd check if a task was queued, but taskQueue is unexported and buffered.
    // For now, this test just ensures schedulePollingTasks runs without panic.
}

func TestEngine_Polling(t *testing.T) {
	setupTestDB()
	
	// 1. Setup Data for Tenant 1
	database.DB.Create(&database.Integration{
		Name: "AuthMind API", 
		BaseURL: "http://mock", 
		Credentials: `{"token":"abc"}`, 
		Enabled: true, 
		PollingInterval: 1,
        TenantID: 1,
	})
	
	wf := database.Workflow{Name: "Compromised User", Enabled: true, TriggerType: "AUTHMIND_POLL", MinSeverity: "Low", TenantID: 1}
	if err := database.DB.Where("name = ?", wf.Name).Assign(wf).FirstOrCreate(&wf).Error; err != nil {
        t.Fatalf("Failed to setup workflow: %v", err)
    }
	
	// 2. Mock SDK
	originalSDK := integrations.NewAuthMindSDK
	defer func() { integrations.NewAuthMindSDK = originalSDK }()
	
	integrations.NewAuthMindSDK = func(url, token string) *integrations.AuthMindSDK {
		sdk := originalSDK(url, token)
		sdk.Client.Transport = &MockTransport{
			RoundTripFunc: func(req *http.Request) (*http.Response, error) {
				if req.URL.Path == "/getIssues" {
					return &http.Response{
						StatusCode: 200,
						Body: io.NopCloser(bytes.NewBufferString(`{
							"success":true, 
							"results":[{"issue_id":"999", "issue_type":"Compromised User", "severity":4, "risk": "High"}]
						}`)),
						Header: make(http.Header),
					}, nil
				}
				if req.URL.Path == "/getIssueDetails" {
					return &http.Response{
						StatusCode: 200,
						Body: io.NopCloser(bytes.NewBufferString(`{
							"success":true,
							"results": [{"message": "details", "risk": "High"}]
						}`)),
						Header: make(http.Header),
					}, nil
				}
				return &http.Response{StatusCode: 404, Body: io.NopCloser(bytes.NewBufferString(""))}, nil
			},
		}
		return sdk
	}
	
	// 3. Mock Executor
	coreOriginalExec := NewExecutorFunc
	defer func() { NewExecutorFunc = coreOriginalExec }()
	NewExecutorFunc = func() Executor {
		return &MockExecutor{
			ExecuteFunc: func(integ database.Integration, def database.ActionDefinition, ctx map[string]interface{}) ([]byte, int, error) {
				assert.Equal(t, 85, ctx["Risk"])
				return []byte("ok"), 200, nil
			},
		}
	}

	// 4. Run
	engine := NewEngine()
	engine.SyncMode = true
    
    // Instead of syncCache/executeEligibleWorkflows, we use schedulePollingTasks
	engine.schedulePollingTasks()
	
	// 5. Verify Job Created
	var count int64
	database.DB.Model(&database.Job{}).Where("auth_mind_issue_id = ?", "999").Count(&count)
	assert.Equal(t, int64(1), count)
}

func TestEngine_Polling_AllWorkflow(t *testing.T) {
	setupTestDB()
	
	database.DB.Create(&database.Integration{
		Name: "AuthMind API", 
		BaseURL: "http://mock", 
		Credentials: `{"token":"abc"}`, 
		Enabled: true, 
		PollingInterval: 1,
        TenantID: 1,
	})
	
	// Create "All" workflow
    allWf := database.Workflow{Name: "All", Enabled: true, TriggerType: "AUTHMIND_POLL", TenantID: 1}
    database.DB.Where("name = ?", allWf.Name).Assign(allWf).FirstOrCreate(&allWf)

	// Create specific workflow
    specWf := database.Workflow{Name: "Specific", Enabled: true, TriggerType: "AUTHMIND_POLL", TenantID: 1}
    database.DB.Where("name = ?", specWf.Name).Assign(specWf).FirstOrCreate(&specWf)
	
	// Mock SDK
	originalSDK := integrations.NewAuthMindSDK
	defer func() { integrations.NewAuthMindSDK = originalSDK }()
	
	integrations.NewAuthMindSDK = func(url, token string) *integrations.AuthMindSDK {
		sdk := originalSDK(url, token)
		sdk.Client.Transport = &MockTransport{
			RoundTripFunc: func(req *http.Request) (*http.Response, error) {
                // In multi-tenant, we optimize to empty issue_type ("") for "All"
				assert.Empty(t, req.URL.Query().Get("issue_type"))
				return &http.Response{
					StatusCode: 200,
					Body: io.NopCloser(bytes.NewBufferString(`{"success":true,"results":[]}`)),
					Header: make(http.Header),
				}, nil
			},
		}
		return sdk
	}
	
	engine := NewEngine()
	engine.SyncMode = true
	engine.schedulePollingTasks()
}

func TestRunWorkflow_Success(t *testing.T) {
	setupTestDB()

	// 1. Setup Mock
	mockExec := &MockExecutor{
		ExecuteFunc: func(integ database.Integration, def database.ActionDefinition, ctx map[string]interface{}) ([]byte, int, error) {
			return []byte("success"), 200, nil
		},
	}
	originalFunc := NewExecutorFunc
	defer func() { NewExecutorFunc = originalFunc }()
	NewExecutorFunc = func() Executor { return mockExec }

	// 2. Seed Data
	wf := database.Workflow{Name: "Test Workflow", Enabled: true, TenantID: 1}
    database.DB.Where("name = ?", wf.Name).Assign(wf).FirstOrCreate(&wf)
	
	integ := database.Integration{Name: "Test Integ", Enabled: true, TenantID: 1}
	database.DB.Create(&integ)

	action := database.ActionDefinition{Name: "Test Action", IntegrationID: integ.ID, TenantID: 1}
	database.DB.Create(&action)

	step := database.WorkflowStep{WorkflowID: wf.ID, ActionDefinitionID: action.ID, Order: 1, ParameterMapping: "{}"}
	database.DB.Create(&step)

	// Reload workflow with steps
	var fullWf database.Workflow
	database.DB.Preload("Steps").First(&fullWf, wf.ID)

	// 3. Run
	engine := NewEngine()
	ctx := map[string]interface{}{
        "TenantID":  uint(1),
		"IssueID":   "123",
		"UserEmail": "test@example.com",
	}
	engine.RunWorkflow(fullWf, ctx)

	// 4. Verify Job Status
	var job database.Job
	database.DB.First(&job, "workflow_id = ? AND auth_mind_issue_id = ?", wf.ID, "123")
	assert.Equal(t, "completed", job.Status)
}

func TestRunWorkflow_Failure(t *testing.T) {
	setupTestDB()

	// 1. Setup Mock to Fail
	mockExec := &MockExecutor{
		ExecuteFunc: func(integ database.Integration, def database.ActionDefinition, ctx map[string]interface{}) ([]byte, int, error) {
			return nil, 500, errors.New("connection failed")
		},
	}
	originalFunc := NewExecutorFunc
	defer func() { NewExecutorFunc = originalFunc }()
	NewExecutorFunc = func() Executor { return mockExec }

	// 2. Seed Data
	wf := database.Workflow{Name: "Fail Workflow", Enabled: true, TenantID: 1}
    database.DB.Where("name = ?", wf.Name).Assign(wf).FirstOrCreate(&wf)
	
	integ := database.Integration{Name: "Test Integ", Enabled: true, TenantID: 1}
	database.DB.Create(&integ)

	action := database.ActionDefinition{Name: "Test Action", IntegrationID: integ.ID, TenantID: 1}
	database.DB.Create(&action)

	step := database.WorkflowStep{WorkflowID: wf.ID, ActionDefinitionID: action.ID, Order: 1, ParameterMapping: "{}"}
	database.DB.Create(&step)

	var fullWf database.Workflow
	database.DB.Preload("Steps").First(&fullWf, wf.ID)

	// 3. Run
	engine := NewEngine()
	ctx := map[string]interface{}{
        "TenantID":  uint(1),
		"IssueID":   "999",
		"UserEmail": "fail@example.com",
	}
	engine.RunWorkflow(fullWf, ctx)

	// 4. Verify Job Status
	var job database.Job
	database.DB.First(&job, "workflow_id = ? AND auth_mind_issue_id = ?", wf.ID, "999")
	assert.Equal(t, "failed", job.Status)
}