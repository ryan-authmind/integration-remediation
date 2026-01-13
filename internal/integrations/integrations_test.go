package integrations

import (
	"bytes"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestServiceNow_CreateIncident(t *testing.T) {
	client := &ServiceNowClient{
		BaseURL:  "https://sn.example.com",
		Username: "admin",
		Password: "password",
		Client:   &http.Client{},
	}

	mockResp := `{
		"result": {
			"number": "INC001",
			"sys_id": "sys_123"
		}
	}`

	client.Client.Transport = &MockTransport{
		RoundTripFunc: func(req *http.Request) (*http.Response, error) {
			assert.Equal(t, "POST", req.Method)
			assert.Contains(t, req.URL.String(), "/api/now/table/incident")
			return &http.Response{
				StatusCode: 201,
				Body:       io.NopCloser(bytes.NewBufferString(mockResp)),
				Header:     make(http.Header),
			}, nil
		},
	}

	resp, err := client.CreateIncident("Test Incident", "Details")
	assert.NoError(t, err)
	assert.Equal(t, "INC001", resp.Result.Number)
}

func TestSlack_SendNotification(t *testing.T) {
	client := &SlackClient{
		WebhookURL: "https://hooks.slack.com/services/xxx",
		Client:     &http.Client{},
	}

	client.Client.Transport = &MockTransport{
		RoundTripFunc: func(req *http.Request) (*http.Response, error) {
			assert.Equal(t, "POST", req.Method)
			assert.Contains(t, req.URL.String(), "hooks.slack.com")
			return &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewBufferString("ok")),
				Header:     make(http.Header),
			}, nil
		},
	}

	err := client.SendNotification("Hello World")
	assert.NoError(t, err)
}
