package integrations

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type ServiceNowClient struct {
	BaseURL  string
	Username string
	Password string
	Client   *http.Client
}

type IncidentRequest struct {
	ShortDescription string `json:"short_description"`
	Description      string `json:"description"`
	Urgency          string `json:"urgency"`
	Impact           string `json:"impact"`
}

type IncidentResponse struct {
	Result struct {
		Number string `json:"number"`
		SysID  string `json:"sys_id"`
	} `json:"result"`
}

func (s *ServiceNowClient) CreateIncident(desc string, details string) (*IncidentResponse, error) {
	url := fmt.Sprintf("%s/api/now/table/incident", s.BaseURL)
	
	payload := IncidentRequest{
		ShortDescription: desc,
		Description:      details,
		Urgency:          "1", // High
		Impact:           "1", // High
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	req.SetBasicAuth(s.Username, s.Password)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := s.Client
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("ServiceNow error: %s", resp.Status)
	}

	var result IncidentResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}
