package core

import (
	"bytes"
	"io"
	"net/http"
	"remediation-engine/internal/database"
	"testing"

	"github.com/stretchr/testify/assert"
)

// MockHTTPClient is a wrapper to intercept requests
type MockTransport struct {
	RoundTripFunc func(req *http.Request) (*http.Response, error)
}

func (m *MockTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return m.RoundTripFunc(req)
}

func setupTestDB() {
	// Initialize in-memory database for testing
	database.InitDB(":memory:")
    // Create default tenant for tests
    database.DB.FirstOrCreate(&database.Tenant{ID: 1, Name: "Default Tenant"})
}

func TestExecuteREST_Success(t *testing.T) {
	setupTestDB()
	
	// 1. Setup Mock Executor
	executor := NewActionExecutor()
	mockTransport := &MockTransport{
		RoundTripFunc: func(req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewBufferString(`{"result":"success", "id":"12345"}`)),
				Header:     make(http.Header),
			}, nil
		},
	}
	executor.Client.Transport = mockTransport

	// 2. Define Inputs
	integ := database.Integration{
		Name:     "Test Integration",
		Type:     "REST",
		BaseURL:  "https://api.example.com",
		AuthType: "none",
		Enabled:  true,
		IsAvailable: true,
	}
	database.DB.Create(&integ) // Save to DB so updates work
	
	def := database.ActionDefinition{
		Name:         "Create Ticket",
		Method:       "POST",
		PathTemplate: "/create",
		BodyTemplate: `{"user": "{{.User}}"}`,
	}
	
	ctx := map[string]interface{}{
		"User": "test@example.com",
	}

	// 3. Execute
	resp, code, err := executor.Execute(integ, def, ctx)

	// 4. Assert
	if err != nil {
		t.Fatalf("Expected success, got error: %v", err)
	}

	assert.Equal(t, 200, code)
	expected := `{"result":"success", "id":"12345"}`
	if string(resp) != expected {
		t.Errorf("Expected response %s, got %s", expected, string(resp))
	}
}

func TestExecuteREST_TemplateError(t *testing.T) {
	setupTestDB()
	
	executor := NewActionExecutor()
	// Reduce retries to 0 for faster test
	integ := database.Integration{BaseURL: "http://test", IsAvailable: true}
	database.DB.Create(&integ)

	def := database.ActionDefinition{
		Name: "Bad Template", 
		Method: "POST", 
		BodyTemplate: "{{.MissingFunction}}", // Invalid template syntax
		RetryCount: 0, // No retries
	}

	_, _, err := executor.Execute(integ, def, map[string]interface{}{})
	if err == nil {
		t.Error("Expected template error, got nil")
	}
}

func TestExecuteREST_AuthTypes(t *testing.T) {
	setupTestDB()
	executor := NewActionExecutor()
	
	tests := []struct {
		name     string
		authType string
		creds    string
		verify   func(r *http.Request) bool
	}{
		{"Basic", "basic", `{"username":"u","password":"p"}`, func(r *http.Request) bool {
			u, p, _ := r.BasicAuth()
			return u == "u" && p == "p"
		}},
		{"Bearer", "bearer", `{"token":"tok"}`, func(r *http.Request) bool {
			return r.Header.Get("Authorization") == "Bearer tok"
		}},
		{"APIKey", "apikey", `{"header_name":"X-Key","api_key":"123"}`, func(r *http.Request) bool {
			return r.Header.Get("X-Key") == "123"
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			integ := database.Integration{
				Name: tt.name, BaseURL: "http://test", AuthType: tt.authType, Credentials: tt.creds, IsAvailable: true,
			}
			database.DB.Create(&integ)
			// Reload to decrypt credentials
			database.DB.First(&integ, integ.ID)
			
			def := database.ActionDefinition{Method: "GET", Name: tt.name}
			
			executor.Client.Transport = &MockTransport{
				RoundTripFunc: func(req *http.Request) (*http.Response, error) {
					if !tt.verify(req) {
						t.Errorf("Auth verification failed for %s", tt.name)
					}
					return &http.Response{StatusCode: 200, Body: io.NopCloser(bytes.NewBufferString("ok"))}, nil
				},
			}
			
			_, _, err := executor.Execute(integ, def, map[string]interface{}{})
			assert.NoError(t, err)
		})
	}
}
