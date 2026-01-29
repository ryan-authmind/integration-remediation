package api

import (
	"encoding/json"
	"remediation-engine/internal/database"
	"time"

	"github.com/gin-gonic/gin"
)

// LogAudit records an administrative action in the database
func LogAudit(c *gin.Context, userID uint, tenantID uint, action string, resource string, targetID string, details interface{}) {
	detailsJSON, _ := json.Marshal(details)

	var uID *uint
	if userID != 0 {
		uID = &userID
	}

	var tID *uint
	if tenantID != 0 {
		tID = &tenantID
	}

	log := database.AuditLog{
		Timestamp: time.Now(),
		UserID:    uID,
		TenantID:  tID,
		Action:    action,
		Resource:  resource,
		TargetID:  targetID,
		Details:   string(detailsJSON),
		IP:        c.ClientIP(),
	}

	database.DB.Create(&log)
}

// GetAuditLogs returns the audit history
func GetAuditLogs(c *gin.Context) {
    // Basic implementation for now
    var logs []database.AuditLog
    database.DB.Preload("User").Preload("Tenant").Order("timestamp desc").Limit(100).Find(&logs)
    c.JSON(200, logs)
}
