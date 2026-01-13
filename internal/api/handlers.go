package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"remediation-engine/internal/database"
    "remediation-engine/internal/core"
    "time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetIntegrations returns all configured integrations
func GetIntegrations(c *gin.Context) {
	var integrations []database.Integration
	database.DB.Find(&integrations)
	c.JSON(http.StatusOK, integrations)
}

// CreateIntegration adds a new integration
func CreateIntegration(c *gin.Context) {
	var input database.Integration
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, input)
}

// CreateActionDefinition adds a new action template
func CreateActionDefinition(c *gin.Context) {
	var input database.ActionDefinition
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, input)
}

// ImportConfiguration handles bulk import of integrations and actions
func ImportConfiguration(c *gin.Context) {
	var input struct {
		Integrations []database.Integration      `json:"integrations"`
		Actions      []database.ActionDefinition `json:"actions"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx := database.DB.Begin()

	for _, it := range input.Integrations {
		if err := tx.Create(&it).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create integration %s: %v", it.Name, err)})
			return
		}
	}

	for _, ac := range input.Actions {
		if err := tx.Create(&ac).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create action %s: %v", ac.Name, err)})
			return
		}
	}

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Imported configuration successfully"})
}

// GetActionDefinitions returns all action templates
func GetActionDefinitions(c *gin.Context) {
	var definitions []database.ActionDefinition
	database.DB.Find(&definitions)
	c.JSON(http.StatusOK, definitions)
}

// UpdateActionDefinition saves changes to an action template
func UpdateActionDefinition(c *gin.Context) {
	var input database.ActionDefinition
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Save(&input)
	c.JSON(http.StatusOK, input)
}

// UpdateIntegration saves changes to an integration
func UpdateIntegration(c *gin.Context) {
	var input database.Integration
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Save(&input)
	c.JSON(http.StatusOK, input)
}

// GetWorkflows returns all workflows and their steps
func GetWorkflows(c *gin.Context) {
	var workflows []database.Workflow
	database.DB.Preload("Steps").Preload("Steps.ActionDefinition").Find(&workflows)
	c.JSON(http.StatusOK, workflows)
}

// CreateWorkflow adds a new workflow to the system
func CreateWorkflow(c *gin.Context) {
	var workflow database.Workflow
	if err := c.ShouldBindJSON(&workflow); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Create(&workflow)
	c.JSON(http.StatusCreated, workflow)
}

// UpdateWorkflow saves changes to a workflow (e.g. enabling/disabling)
func UpdateWorkflow(c *gin.Context) {
	var workflow database.Workflow
	if err := c.ShouldBindJSON(&workflow); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Use a transaction to update workflow and its steps
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Update basic info
		if err := tx.Model(&workflow).Select("name", "description", "enabled", "trigger_type").Updates(workflow).Error; err != nil {
			return err
		}

		// 2. Clear old steps
		if err := tx.Where("workflow_id = ?", workflow.ID).Delete(&database.WorkflowStep{}).Error; err != nil {
			return err
		}

		// 3. Insert new steps
		for i := range workflow.Steps {
			workflow.Steps[i].WorkflowID = workflow.ID
			workflow.Steps[i].ID = 0 // Ensure they are created as new records
			if err := tx.Create(&workflow.Steps[i]).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, workflow)
}

// DeleteWorkflow archives a workflow using soft delete
func DeleteWorkflow(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&database.Workflow{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "workflow archived successfully"})
}

// GetJobs returns the history of executions
func GetJobs(c *gin.Context) {
	var jobs []database.Job
	database.DB.Preload("Workflow").Order("created_at desc").Limit(50).Find(&jobs)
	c.JSON(http.StatusOK, jobs)
}

// GetJobLogs returns detailed logs for a specific job
func GetJobLogs(c *gin.Context) {
	id := c.Param("id")
	var logs []database.JobLog
	database.DB.Where("job_id = ?", id).Find(&logs)
	c.JSON(http.StatusOK, logs)
}

// RerunJob triggers a manual execution of a previous job's workflow
func RerunJob(c *gin.Context) {
	id := c.Param("id")
	var oldJob database.Job
	if err := database.DB.Preload("Workflow").Preload("Workflow.Steps.ActionDefinition").First(&oldJob, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	// Prepare context from old job
	contextData := make(map[string]interface{})
	if oldJob.TriggerContext != "" {
		json.Unmarshal([]byte(oldJob.TriggerContext), &contextData)
	} else {
		// Fallback for older jobs without stored context
		contextData["IssueID"] = oldJob.AuthMindIssueID
		contextData["UserEmail"] = "rerun-task@example.com"
	}
	
	contextData["Timestamp"] = time.Now().Format(time.RFC3339)
	contextData["ManualRerun"] = true

	// To get the real UserEmail, we try to find it in the logs or state
	// For now, we use the engine's exported RunWorkflow
	if core.GlobalEngine != nil {
		go core.GlobalEngine.RunWorkflow(oldJob.Workflow, contextData)
		c.JSON(http.StatusOK, gin.H{"status": "rerun triggered"})
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "engine not initialized"})
	}
}

// GetDashboardStats calculates metrics for the UI
func GetDashboardStats(c *gin.Context) {
	var stats struct {
		TotalJobs       int64            `json:"total_jobs"`
		SuccessJobs     int64            `json:"success_jobs"`
		FailedJobs      int64            `json:"failed_jobs"`
		RunningJobs     int64            `json:"running_jobs"`
		ActiveWorkflows int64            `json:"active_workflows"`
		WorkflowBreakdown map[string]int64 `json:"workflow_breakdown"`
	}

	database.DB.Model(&database.Job{}).Count(&stats.TotalJobs)
	database.DB.Model(&database.Job{}).Where("status = ?", "completed").Count(&stats.SuccessJobs)
	database.DB.Model(&database.Job{}).Where("status = ?", "failed").Count(&stats.FailedJobs)
	database.DB.Model(&database.Job{}).Where("status = ?", "running").Count(&stats.RunningJobs)
	database.DB.Model(&database.Workflow{}).Where("enabled = ?", true).Count(&stats.ActiveWorkflows)

    // Calculate breakdown
    var results []struct {
        Name  string
        Count int64
    }
    database.DB.Table("jobs").
        Select("workflows.name, count(jobs.id) as count").
        Joins("left join workflows on workflows.id = jobs.workflow_id").
        Group("workflows.name").
        Scan(&results)

    stats.WorkflowBreakdown = make(map[string]int64)
    for _, r := range results {
        stats.WorkflowBreakdown[r.Name] = r.Count
    }

	c.JSON(http.StatusOK, stats)
}

// GetSettings returns all system settings
func GetSettings(c *gin.Context) {
	var settings []database.SystemSetting
	database.DB.Find(&settings)
	c.JSON(http.StatusOK, settings)
}

// UpdateSetting updates a specific system setting
func UpdateSetting(c *gin.Context) {
	var input database.SystemSetting
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Model(&database.SystemSetting{}).Where("key = ?", input.Key).Update("value", input.Value)
	c.JSON(http.StatusOK, input)
}
