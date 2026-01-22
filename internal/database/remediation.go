package database

import "time"

// RemediationRecommendation represents general remediation advice for a specific issue type
type RemediationRecommendation struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// IssueType corresponds to the 'issue_type' field in AuthMind API
	IssueType    string `gorm:"uniqueIndex" json:"issue_type"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	Steps        string `json:"steps"`         // Markdown or structured text
	ReferenceURL string `json:"reference_url"` // Link to official documentation
}
