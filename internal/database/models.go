package database

import (
	"remediation-engine/internal/security"
	"time"

	"gorm.io/gorm"
)

// Tenant represents a customer or distinct environment
type Tenant struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Name        string `gorm:"uniqueIndex" json:"name"`
	Description string `json:"description"`
	APIKey      *string `gorm:"uniqueIndex" json:"api_key"` // Pointer allows NULLs to coexist in unique index
}

// Integration represents a 3rd party service provider
type Integration struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	TenantID uint   `gorm:"index:idx_tenant_name,unique" json:"tenant_id"` // Multi-tenancy
    Tenant   Tenant `gorm:"foreignKey:TenantID" json:"tenant"`
	Name     string `gorm:"index:idx_tenant_name,unique" json:"name"` 

	Type            string `json:"type"`      // e.g., "REST", "SLACK", "EMAIL"
	BaseURL         string `json:"base_url"`  // Encrypted if sensitive
	AuthType        string `json:"auth_type"` // "none", "basic", "bearer", "apikey", "oauth2"
	Credentials     string `json:"credentials"`
	Enabled         bool   `json:"enabled"`
	PollingInterval int    `json:"polling_interval"` // In seconds
	RateLimit       float64 `json:"rate_limit"`       // Requests per second (0 = unlimited)

	// OAuth2 specific fields
	TokenEndpoint  string     `json:"token_endpoint"`
	OAuthToken     string     `json:"-"`
	OAuthExpiresAt *time.Time `json:"-"`

	LastRotatedAt    *time.Time `json:"last_rotated_at"`
	RotationInterval int        `json:"rotation_interval_days"`

	// Circuit Breaker fields
	ConsecutiveFailures int  `gorm:"default:0" json:"consecutive_failures"`
	IsAvailable         bool `gorm:"default:true" json:"is_available"`
}

// BeforeSave hook to encrypt credentials
func (i *Integration) BeforeSave(tx *gorm.DB) (err error) {
	if i.Credentials != "" {
		i.Credentials, err = security.Encrypt(i.Credentials)
	}
	return
}

// AfterFind hook to decrypt credentials
func (i *Integration) AfterFind(tx *gorm.DB) (err error) {
	if i.Credentials != "" {
		i.Credentials, err = security.Decrypt(i.Credentials)
	}
	return
}

// ActionDefinition is a reusable API template
type ActionDefinition struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	TenantID uint   `gorm:"index" json:"tenant_id"`
    Tenant   Tenant `gorm:"foreignKey:TenantID" json:"tenant"`
	Name     string `gorm:"index" json:"name"` // Removed global unique index

	Vendor        string `json:"vendor"`
	IntegrationID uint   `json:"integration_id"`

	Method       string `json:"method"`
	PathTemplate string `json:"path_template"`
	BodyTemplate string `json:"body_template"`

	SuccessField string `json:"success_field"`

	// Optional specific retry count for this action
	RetryCount int `gorm:"default:3" json:"retry_count"`
}

// Workflow defines a remediation process
type Workflow struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	TenantID uint   `gorm:"index" json:"tenant_id"`
    Tenant   Tenant `gorm:"foreignKey:TenantID" json:"tenant"`
	Name     string `gorm:"index" json:"name"` // Removed global unique index

	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`

	TriggerType string `json:"trigger_type"`
    MinSeverity string `gorm:"default:'Low'" json:"min_severity"` // Low, Medium, High, Critical

    // Pollers associated with this workflow (Many-to-Many)
    AuthMindPollers []Integration `gorm:"many2many:workflow_pollers;" json:"pollers"`

	Steps []WorkflowStep `gorm:"foreignKey:WorkflowID" json:"steps"`
}

// WorkflowStep references a definition and provides parameters
type WorkflowStep struct {
	ID         uint `gorm:"primaryKey" json:"id"`
	WorkflowID uint `json:"workflow_id"`
	Order      int  `json:"order"`

	ActionDefinitionID uint             `json:"action_definition_id"`
	ActionDefinition   ActionDefinition `gorm:"foreignKey:ActionDefinitionID" json:"definition"`

	ParameterMapping string `json:"parameter_mapping"`
}

// Job represents a single execution of a workflow
type Job struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	TenantID   uint     `gorm:"index" json:"tenant_id"`
    Tenant     Tenant   `gorm:"foreignKey:TenantID" json:"tenant"`
	WorkflowID uint     `gorm:"index:idx_wf_issue,unique" json:"workflow_id"`
	Workflow   Workflow `gorm:"foreignKey:WorkflowID" json:"workflow"`
	Status     string   `json:"status"` // "pending", "running", "completed", "failed"

	// AuthMindIssueID tracks which specific incident this job processed
	AuthMindIssueID string `gorm:"index:idx_wf_issue,unique" json:"authmind_issue_id"`

	// TriggerContext stores the JSON serialized contextData for reruns
	TriggerContext string `json:"trigger_context"`

	Logs []JobLog `gorm:"foreignKey:JobID" json:"logs"`
}

// JobLog stores detailed execution steps
type JobLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	JobID     uint      `json:"job_id"`
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"` // "INFO", "ERROR"
	Message   string    `json:"message"`
}

// ProcessedEvent tracks every event seen by the system for throughput metrics
type ProcessedEvent struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	CreatedAt       time.Time `json:"created_at"`
	TenantID        uint      `gorm:"index" json:"tenant_id"`
	AuthMindIssueID string    `gorm:"index" json:"authmind_issue_id"`
}

// StateStore replaces 'latest_issue_ids.json'
type StateStore struct {
	Key   string `gorm:"primaryKey" json:"key"`
	Value string `json:"value"`
}

// SystemSetting stores global application configurations
type SystemSetting struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Key         string `gorm:"uniqueIndex" json:"key"`
	Value       string `json:"value"`
	Description string `json:"description"`
}

// MessageTemplate stores localized strings for notifications
type MessageTemplate struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	TenantID  uint   `gorm:"index:idx_tenant_issue_lang,unique" json:"tenant_id"`
	IssueType string `gorm:"index:idx_tenant_issue_lang,unique" json:"issue_type"` // e.g., "Compromised User"
	Language  string `gorm:"index:idx_tenant_issue_lang,unique" json:"language"`   // e.g., "en", "he"

	Title   string `json:"title"`
	Message string `json:"message"`
	Footer  string `json:"footer"`
}
