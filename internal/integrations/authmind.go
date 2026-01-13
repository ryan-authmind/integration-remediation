package integrations

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// AuthMindSDK provides a structured client for interacting with the AuthMind API.
// It serves as the internal source of truth for AuthMind data models.
type AuthMindSDK struct {
	BaseURL string
	Token   string
	Client  *http.Client
}

// NewAuthMindSDK creates a new instance of the SDK.
var NewAuthMindSDK = func(baseURL, token string) *AuthMindSDK {
	return &AuthMindSDK{
		BaseURL: baseURL,
		Token:   token,
		Client:  &http.Client{Timeout: 30 * time.Second},
	}
}

// --- Data Models ---

type Issue struct {
	IssueTime       string                 `json:"issue_time"`
	IssueID         string                 `json:"issue_id"`
	IssueType       string                 `json:"issue_type"`
	PlaybookName    string                 `json:"playbook_name"`
	IssueKeys       map[string]interface{} `json:"issue_keys"`
	Message         string                 `json:"message"`
	Risk            string                 `json:"risk"`
	FlowCount       int                    `json:"flow_count"`
	IncidentCount   int                    `json:"incident_count"`
	IncidentsURL    string                 `json:"incidents_url"`
	IssueDetailsAPI string                 `json:"issue_details_api"`
	Severity        int                    `json:"severity"` // Keep for internal logic if present
}

type IssueDetails struct {
	Success  bool                   `json:"success"`
	Results  []IssueDetailItem      `json:"results"`
	Metadata map[string]interface{} `json:"metadata"`
}

type IssueDetailItem struct {
	FirstSeen          string                 `json:"first_seen"`
	LastSeen           string                 `json:"last_seen"`
	Risk               string                 `json:"risk"`
	Message            string                 `json:"message"`
	IssueType          string                 `json:"issue_type"`
	IssueKeys          map[string]interface{} `json:"issue_keys"`
	IncidentsURL       string                 `json:"incidents_url"`
	TotalFlowCount     int                    `json:"total_flow_count"`
	TotalIncidentCount int                    `json:"total_incident_count"`
	Incidents          []Incident             `json:"incidents"`
}

type Incident struct {
	AssetHostname      string `json:"asset_hostname"`
	AssetName          string `json:"asset_name"`
	AssetPort          int    `json:"asset_port"`
	AssetProtocol      string `json:"asset_protocol"`
	AssetType          string `json:"asset_type"`
	FirstSeen          string `json:"first_seen"`
	FlowCount          int    `json:"flow_count"`
	IdentityHostname   string `json:"identity_hostname"`
	IdentityName       string `json:"identity_name"`
	IdentityType       string `json:"identity_type"`
	IncidentID         int    `json:"incident_id"`
	IncidentRisk       string `json:"incident_risk"`
	IncidentURL        string `json:"incident_url"`
	IncidentHighlights string `json:"incident_highlights"`
	LastSeen           string `json:"last_seen"`
	PlaybookName       string `json:"playbook_name"`
	SiteCode           string `json:"site_code"`
	Status             string `json:"status"`
}

// Summary is a helper for templates to get the main message without indexing
func (d *IssueDetails) Summary() string {
	if len(d.Results) > 0 {
		return d.Results[0].Message
	}
	return ""
}

// Risk is a helper for templates to get the main risk level
func (d *IssueDetails) RiskScore() string {
	if len(d.Results) > 0 {
		return d.Results[0].Risk
	}
	return ""
}

// --- SDK Methods ---

func (s *AuthMindSDK) GetIssues(issueType string, sinceID string) ([]Issue, error) {
	twoMonthsAgo := time.Now().AddDate(0, -2, 0).Format("2006-01-02 15:04:05")
	
	params := url.Values{}
	if issueType != "All" && issueType != "" {
		params.Add("issue_type", issueType)
	}
	params.Add("issue_id_gt", sinceID)
	params.Add("issue_time_gt", twoMonthsAgo)
	params.Add("sort_order", "ASC")
	params.Add("sort_by", "issue_id")
	params.Add("from", "0")
	params.Add("size", "100")

	fullURL := fmt.Sprintf("%s/getIssues?%s", s.BaseURL, params.Encode())

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+s.Token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("authmind sdk: api error %d for type %s", resp.StatusCode, issueType)
	}

	var wrapper struct {
		Success  bool                   `json:"success"`
		Results  []Issue                `json:"results"`
		Metadata map[string]interface{} `json:"metadata"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&wrapper); err != nil {
		return nil, err
	}

	return wrapper.Results, nil
}

func (s *AuthMindSDK) GetIssueDetails(issueID string) (*IssueDetails, error) {
	params := url.Values{}
	params.Add("issue_id", issueID)
	params.Add("sort_order", "ASC")
	params.Add("sort_by", "incident_id")
	params.Add("from", "0")
	params.Add("size", "1000")

	fullURL := fmt.Sprintf("%s/getIssueDetails?%s", s.BaseURL, params.Encode())

	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+s.Token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("authmind sdk: api error %d", resp.StatusCode)
	}

	var details IssueDetails
	if err := json.NewDecoder(resp.Body).Decode(&details); err != nil {
		return nil, err
	}

	return &details, nil
}
