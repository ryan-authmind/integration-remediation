package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"remediation-engine/internal/core"
	"remediation-engine/internal/database"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

// Define a simple mock executor for API tests
type APIExecutor struct{}
func (e *APIExecutor) Execute(integration database.Integration, definition database.ActionDefinition, contextData map[string]interface{}) ([]byte, int, error) {
	return []byte("mock success"), 200, nil
}

func setupRouter() *gin.Engine {
	// Initialize in-memory DB
	database.InitDB(":memory:")
	
	// Initialize Engine
	core.NewEngine()
	
	// Mock Executor
	core.NewExecutorFunc = func() core.Executor {
		return &APIExecutor{}
	}

	r := gin.Default()
	r.GET("/api/integrations", GetIntegrations)
	r.POST("/api/integrations", CreateIntegration)
	r.PUT("/api/integrations", UpdateIntegration)
	
	r.GET("/api/actions", GetActionDefinitions)
	r.POST("/api/actions", CreateActionDefinition)
	r.PUT("/api/actions", UpdateActionDefinition)
	
	r.POST("/api/import", ImportConfiguration)
	
	r.GET("/api/workflows", GetWorkflows)
	r.POST("/api/workflows", CreateWorkflow)
	r.PUT("/api/workflows", UpdateWorkflow)
	r.DELETE("/api/workflows/:id", DeleteWorkflow)
	
	r.GET("/api/jobs", GetJobs)
	r.GET("/api/jobs/:id/logs", GetJobLogs)
	r.POST("/api/jobs/:id/rerun", RerunJob)
	
	r.GET("/api/stats", GetDashboardStats)
	
	return r
}

func TestGetIntegrations_Empty(t *testing.T) {
	router := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/integrations", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "[]", w.Body.String())
}

func TestCreateIntegration(t *testing.T) {
	router := setupRouter()

	integ := database.Integration{
		Name:    "Test API",
		Type:    "REST",
		BaseURL: "http://example.com",
		Enabled: true,
        TenantID: 1,
	}
	body, _ := json.Marshal(integ)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/integrations", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var saved database.Integration
	database.DB.First(&saved, "name = ?", "Test API")
	assert.Equal(t, "Test API", saved.Name)
}

func TestCreateIntegration_Invalid(t *testing.T) {
	router := setupRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/integrations", bytes.NewBufferString("{invalid json"))
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestUpdateIntegration(t *testing.T) {
	router := setupRouter()
	
	integ := database.Integration{Name: "Old Name", TenantID: 1}
	database.DB.Create(&integ)

	integ.Name = "New Name"
	body, _ := json.Marshal(integ)
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("PUT", "/api/integrations", bytes.NewBuffer(body))
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var check database.Integration
	database.DB.First(&check, integ.ID)
	assert.Equal(t, "New Name", check.Name)
}

func TestGetActionDefinitions(t *testing.T) {
	router := setupRouter()

	database.DB.Create(&database.ActionDefinition{
		Name: "Test Action",
		Vendor: "Test",
		Method: "POST",
        TenantID: 1,
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/actions", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "Test Action")
}

func TestCreateActionDefinition(t *testing.T) {
	router := setupRouter()

	action := database.ActionDefinition{
		Name: "New Action",
		Vendor: "VendorX",
		Method: "GET",
		PathTemplate: "/api/v1/resource",
	}
	body, _ := json.Marshal(action)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/actions", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestUpdateActionDefinition(t *testing.T) {
	router := setupRouter()
	
	act := database.ActionDefinition{Name: "Old Action", TenantID: 1}
	database.DB.Create(&act)

	act.Name = "Updated Action"
	body, _ := json.Marshal(act)
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("PUT", "/api/actions", bytes.NewBuffer(body))
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var check database.ActionDefinition
	database.DB.First(&check, act.ID)
	assert.Equal(t, "Updated Action", check.Name)
}

func TestImportConfiguration(t *testing.T) {
	router := setupRouter()
	
	payload := `{
		"integrations": [{"name": "Imp Integ", "type": "REST"}],
		"actions": [{"name": "Imp Action", "vendor": "V", "integration_id": 1}]
	}`
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/import", bytes.NewBufferString(payload))
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var count int64
	database.DB.Model(&database.Integration{}).Count(&count)
	assert.Equal(t, int64(1), count)
}

func TestImportConfiguration_Invalid(t *testing.T) {
	router := setupRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/import", bytes.NewBufferString("{invalid"))
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestCreateActionDefinition_Invalid(t *testing.T) {
	router := setupRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/actions", bytes.NewBufferString("{"))
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGetWorkflows(t *testing.T) {
	router := setupRouter()
	
	database.DB.Create(&database.Workflow{Name: "WF1", Enabled: true, TenantID: 1})
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/workflows", nil)
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "WF1")
}

func TestCreateWorkflow(t *testing.T) {
	router := setupRouter()
	
	wf := database.Workflow{Name: "New WF", Enabled: true}
	body, _ := json.Marshal(wf)
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/workflows", bytes.NewBuffer(body))
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusCreated, w.Code)
}

func TestUpdateWorkflow(t *testing.T) {
	router := setupRouter()
	
	// Create required actions first
	act1 := database.ActionDefinition{Name: "Act1", TenantID: 1}
	database.DB.Create(&act1)
	act2 := database.ActionDefinition{Name: "Act2", TenantID: 1}
	database.DB.Create(&act2)

	wf := database.Workflow{Name: "Old WF", Enabled: true, TenantID: 1}
	database.DB.Create(&wf)
	database.DB.Create(&database.WorkflowStep{WorkflowID: wf.ID, ActionDefinitionID: act1.ID, Order: 1})

	wf.Enabled = false
	wf.Steps = []database.WorkflowStep{
		{ActionDefinitionID: act2.ID, Order: 1, ParameterMapping: "{}"},
	}
	body, _ := json.Marshal(wf)
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("PUT", "/api/workflows", bytes.NewBuffer(body))
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var check database.Workflow
	database.DB.Preload("Steps").First(&check, wf.ID)
	assert.False(t, check.Enabled)
	assert.Len(t, check.Steps, 1)
	assert.Equal(t, act2.ID, check.Steps[0].ActionDefinitionID)
}

func TestDeleteWorkflow(t *testing.T) {
	router := setupRouter()
	
	wf := database.Workflow{Name: "To Delete", TenantID: 1}
	database.DB.Create(&wf)
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", fmt.Sprintf("/api/workflows/%d", wf.ID), nil)
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	// Check archived (GORM soft delete)
	var count int64
	database.DB.Model(&database.Workflow{}).Where("id = ?", wf.ID).Count(&count)
	assert.Equal(t, int64(0), count) // Not in normal find
	
	database.DB.Unscoped().Model(&database.Workflow{}).Where("id = ?", wf.ID).Count(&count)
	assert.Equal(t, int64(1), count) // Found in unscoped (archived)
}

func TestGetJobs_And_Logs(t *testing.T) {
	router := setupRouter()
	
	wf := database.Workflow{Name: "JobWF", Enabled: true, TenantID: 1}
	database.DB.Create(&wf)

	job := database.Job{Status: "completed", WorkflowID: wf.ID, AuthMindIssueID: "issue-1", TenantID: 1}
	database.DB.Create(&job)
	
	log := database.JobLog{JobID: job.ID, Message: "Test Log"}
	database.DB.Create(&log)
	
	// Get Jobs
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/jobs", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	
	// Get Logs
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", fmt.Sprintf("/api/jobs/%d/logs", job.ID), nil)
	router.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code)
	assert.Contains(t, w2.Body.String(), "Test Log")
}

func TestGetDashboardStats(t *testing.T) {
	router := setupRouter()
	
	wf := database.Workflow{Name: "StatsWF", Enabled: true, TenantID: 1}
	database.DB.Create(&wf)

	database.DB.Create(&database.Job{Status: "completed", WorkflowID: wf.ID, AuthMindIssueID: "1", TenantID: 1})
	database.DB.Create(&database.Job{Status: "failed", WorkflowID: wf.ID, AuthMindIssueID: "2", TenantID: 1})
	database.DB.Create(&database.Job{Status: "running", WorkflowID: wf.ID, AuthMindIssueID: "3", TenantID: 1})
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/stats", nil)
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"total_jobs":3`)
	assert.Contains(t, w.Body.String(), `"active_workflows":1`)
	assert.Contains(t, w.Body.String(), `"running_jobs":1`)
}

func TestRerunJob(t *testing.T) {
	router := setupRouter()
	
	// Setup prerequisites
	wf := database.Workflow{Name: "Rerun WF", Enabled: true, TenantID: 1}
	database.DB.Create(&wf)
	
	job := database.Job{WorkflowID: wf.ID, AuthMindIssueID: "100", Status: "completed", TenantID: 1}
	database.DB.Create(&job)
	
	// Need action def and step for rerun to actually run something (or at least try)
	// But MockExecutor will handle execution.
	
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", fmt.Sprintf("/api/jobs/%d/rerun", job.ID), nil)
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	// Wait a bit for async goroutine
	time.Sleep(500 * time.Millisecond)
	
	// Check if new job created
	var rerunJobs []database.Job
	database.DB.Unscoped().Where("auth_mind_issue_id LIKE ?", "%-rerun-%").Find(&rerunJobs)
	if len(rerunJobs) != 1 {
		var all []database.Job
		database.DB.Unscoped().Find(&all)
		for _, j := range all {
			t.Logf("DEBUG Job: ID=%d Status=%s IssueID=%s", j.ID, j.Status, j.AuthMindIssueID)
		}
	}
	assert.Len(t, rerunJobs, 1)
}

func TestRerunJob_NotFound(t *testing.T) {
	router := setupRouter()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/jobs/999/rerun", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusNotFound, w.Code)
}