package integrations

import (
	"bytes"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

// MockTransport reused here
type MockTransport struct {
	RoundTripFunc func(req *http.Request) (*http.Response, error)
}

func (m *MockTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	return m.RoundTripFunc(req)
}

func TestGetIssues_Success(t *testing.T) {
	sdk := NewAuthMindSDK("http://api.test", "token")
	
	// Mock Response
	mockResp := `{
		"success": true,
		"results": [
			{"issue_id": "101", "issue_type": "Compromised User", "severity": 4}
		]
	}`

	sdk.Client.Transport = &MockTransport{
		RoundTripFunc: func(req *http.Request) (*http.Response, error) {
			assert.Equal(t, "GET", req.Method)
			assert.Contains(t, req.URL.String(), "/getIssues")
			return &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewBufferString(mockResp)),
				Header:     make(http.Header),
			}, nil
		},
	}

	issues, err := sdk.GetIssues("Compromised User", "0")
	assert.NoError(t, err)
	assert.Len(t, issues, 1)
	assert.Equal(t, "101", issues[0].IssueID)
}

func TestGetIssueDetails_Success(t *testing.T) {
	sdk := NewAuthMindSDK("http://api.test", "token")
	
	mockResp := `{
		"success": true,
		"results": [
			{ "message": "User logged in from Tor", "risk": "High" }
		]
	}`

	sdk.Client.Transport = &MockTransport{
		RoundTripFunc: func(req *http.Request) (*http.Response, error) {
			assert.Contains(t, req.URL.String(), "/getIssueDetails")
			assert.Contains(t, req.URL.Query().Get("issue_id"), "101")
			return &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewBufferString(mockResp)),
				Header:     make(http.Header),
			}, nil
		},
	}

	details, err := sdk.GetIssueDetails("101")
	assert.NoError(t, err)
	assert.Equal(t, "User logged in from Tor", details.Summary())
	assert.Equal(t, "High", details.RiskScore())
}
