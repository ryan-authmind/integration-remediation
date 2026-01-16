package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"remediation-engine/internal/database"
    "remediation-engine/internal/core"
    "remediation-engine/internal/tenancy"
    "strconv"
    "time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetIntegrations returns all configured integrations
func GetIntegrations(c *gin.Context) {
    tenantID := tenancy.ResolveTenantID(c)
	var integrations []database.Integration
    
    query := database.DB.Preload("Tenant").Model(&database.Integration{})
    // Support Global View (TenantID 0 in multitenant context means "all")
    if tenancy.IsMultiTenant && tenantID == 0 {
        query.Find(&integrations)
    } else {
        query.Where("tenant_id = ?", tenantID).Find(&integrations)
    }
	c.JSON(http.StatusOK, integrations)
}

// CreateIntegration adds a new integration
func CreateIntegration(c *gin.Context) {
	var input database.Integration
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

    input.TenantID = tenancy.ResolveTenantID(c)

		if err := database.DB.Create(&input).Error; err != nil {

			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})

			return

		}

	

	        // Seed default AuthMind Poller for the new tenant

	

	        defaultPoller := database.Integration{

	

	            TenantID:               input.ID,

	

	            Name:                   "AuthMind Poller",

	

	            Type:                   "REST",

	

	            BaseURL:                "https://<tenant-id>.authmind.com/amapi/v1",

	

	            AuthType:               "bearer",

	

	            Credentials:            `{\"token\": \"placeholder\"}`,

	

	            PollingInterval:        60,

	

	            RotationInterval:       0,

	

	            Enabled:                false, // Disabled until configured

	

	            IsAvailable:           true,

	

	        }

	    database.DB.Create(&defaultPoller)

	

		c.JSON(http.StatusCreated, input)

	}

// CreateActionDefinition adds a new action template
func CreateActionDefinition(c *gin.Context) {
	var input database.ActionDefinition
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

    input.TenantID = tenancy.ResolveTenantID(c)

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
    tenantID := tenancy.ResolveTenantID(c)

	for _, it := range input.Integrations {
        it.TenantID = tenantID
		if err := tx.Create(&it).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to create integration %s: %v", it.Name, err)})
			return
		}
	}

	for _, ac := range input.Actions {
        ac.TenantID = tenantID
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
    tenantID := tenancy.ResolveTenantID(c)
	var definitions []database.ActionDefinition
    
    query := database.DB.Preload("Tenant").Model(&database.ActionDefinition{})
    if tenancy.IsMultiTenant && tenantID == 0 {
        query.Find(&definitions)
    } else {
        query.Where("tenant_id = ?", tenantID).Find(&definitions)
    }
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

    input.TenantID = tenancy.ResolveTenantID(c)

    // Protect circuit breaker state from being overwritten by UI updates
    // We use Omit to keep current DB values for these fields
	database.DB.Model(&input).Omit("is_available", "consecutive_failures").Save(&input)
	c.JSON(http.StatusOK, input)
}

// GetWorkflows returns all workflows and their steps
func GetWorkflows(c *gin.Context) {
    tenantID := tenancy.ResolveTenantID(c)
	var workflows []database.Workflow
    
    query := database.DB.Preload("Tenant").Preload("AuthMindPollers").Preload("Steps").Preload("Steps.ActionDefinition")
    if tenancy.IsMultiTenant && tenantID == 0 {
        query.Find(&workflows)
    } else {
        query.Where("tenant_id = ?", tenantID).Find(&workflows)
    }
	c.JSON(http.StatusOK, workflows)
}

// CreateWorkflow adds a new workflow to the system
func CreateWorkflow(c *gin.Context) {
	var workflow database.Workflow
	if err := c.ShouldBindJSON(&workflow); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

    workflow.TenantID = tenancy.ResolveTenantID(c)

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
		if err := tx.Model(&workflow).Select("name", "description", "enabled", "trigger_type", "min_severity").Updates(workflow).Error; err != nil {
			return err
		}

        // 2. Sync Pollers (Many-to-Many)
        if err := tx.Model(&workflow).Association("AuthMindPollers").Replace(workflow.AuthMindPollers); err != nil {
            return err
        }

		// 3. Clear old steps
		if err := tx.Where("workflow_id = ?", workflow.ID).Delete(&database.WorkflowStep{}).Error; err != nil {
			return err
		}

		// 4. Insert new steps
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

// GetJobs returns the history of executions with pagination
func GetJobs(c *gin.Context) {
    page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
    pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
    if page < 1 { page = 1 }
    if pageSize < 1 { pageSize = 10 }
    if pageSize > 100 { pageSize = 100 }

    offset := (page - 1) * pageSize

    var jobs []database.Job
    var total int64
    tenantID := tenancy.ResolveTenantID(c)

    countQuery := database.DB.Model(&database.Job{})
    dataQuery := database.DB.Preload("Tenant").Preload("Workflow").Order("created_at desc").Limit(pageSize).Offset(offset)

    if tenancy.IsMultiTenant && tenantID == 0 {
        countQuery.Count(&total)
        dataQuery.Find(&jobs)
    } else {
        countQuery.Where("tenant_id = ?", tenantID).Count(&total)
        dataQuery.Where("tenant_id = ?", tenantID).Find(&jobs)
    }

    c.JSON(http.StatusOK, gin.H{
        "data":      jobs,
        "total":     total,
        "page":      page,
        "pageSize":  pageSize,
    })
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
    contextData["TenantID"] = tenancy.ResolveTenantID(c)

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

    tenantID := tenancy.ResolveTenantID(c)

	database.DB.Model(&database.Job{}).Where("tenant_id = ?", tenantID).Count(&stats.TotalJobs)
	database.DB.Model(&database.Job{}).Where("tenant_id = ? AND status = ?", tenantID, "completed").Count(&stats.SuccessJobs)
	database.DB.Model(&database.Job{}).Where("tenant_id = ? AND status = ?", tenantID, "failed").Count(&stats.FailedJobs)
	database.DB.Model(&database.Job{}).Where("tenant_id = ? AND status = ?", tenantID, "running").Count(&stats.RunningJobs)
	database.DB.Model(&database.Workflow{}).Where("tenant_id = ? AND enabled = ?", tenantID, true).Count(&stats.ActiveWorkflows)

    // Calculate breakdown
    var results []struct {
        Name  string
        Count int64
    }
    database.DB.Table("jobs").
        Select("workflows.name, count(jobs.id) as count").
        Joins("left join workflows on workflows.id = jobs.workflow_id").
        Where("jobs.tenant_id = ?", tenantID).
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

// GetTenants returns a list of all tenants (Admin only)
func GetTenants(c *gin.Context) {
	var tenants []database.Tenant
	database.DB.Find(&tenants)
	c.JSON(http.StatusOK, tenants)
}

// CreateTenant adds a new customer or environment
func CreateTenant(c *gin.Context) {
	var input database.Tenant
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Handle empty API key clashing with unique index
	if input.APIKey != nil && *input.APIKey == "" {
		input.APIKey = nil
	}

	if err := database.DB.Create(&input).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

    // Automatically bootstrap the tenant with templates
    go func(tenantID int) {
        if err := performBootstrap(tenantID); err != nil {
            fmt.Printf("Auto-bootstrap failed for tenant %d: %v\n", tenantID, err)
        }
    }(int(input.ID))

	c.JSON(http.StatusCreated, input)
}

// UpdateTenant modifies tenant details
func UpdateTenant(c *gin.Context) {
    id := c.Param("id")
	var input database.Tenant
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Handle empty API key clashing with unique index
	if input.APIKey != nil && *input.APIKey == "" {
		input.APIKey = nil
	}

	database.DB.Model(&database.Tenant{}).Where("id = ?", id).Updates(input)
	c.JSON(http.StatusOK, input)
}

// DeleteTenant removes a tenant (Soft delete)
func DeleteTenant(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&database.Tenant{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "tenant deleted successfully"})
}

// BootstrapTenant clones standard seed configurations into a specific tenant
func BootstrapTenant(c *gin.Context) {
    idStr := c.Param("id")
    id, _ := strconv.Atoi(idStr)
    if id == 0 {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant id"})
        return
    }

    if err := performBootstrap(id); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Tenant bootstrapped from templates (Integrations, Actions, Workflows)"})
}

// performBootstrap contains the core logic for cloning seeds
func performBootstrap(tenantID int) error {
    tx := database.DB.Begin()

    // 1. Fetch seed integrations (usually from Tenant ID 1 or a specific file)
    // We'll pull from existing integrations where TenantID = 1 as templates
    var seeds []database.Integration
    if err := database.DB.Where("tenant_id = 1").Find(&seeds).Error; err != nil {
        tx.Rollback()
        return fmt.Errorf("failed to fetch seed integrations: %v", err)
    }

    // Map old Integration ID -> New Integration ID
    intMap := make(map[uint]uint)

    for _, s := range seeds {
        newInt := s
        newInt.ID = 0
        newInt.TenantID = uint(tenantID)
        newInt.Enabled = false // Default to disabled for setup
        if err := tx.Create(&newInt).Error; err != nil {
            tx.Rollback()
            return fmt.Errorf("failed to clone integration %s: %v", s.Name, err)
        }
        intMap[s.ID] = newInt.ID
    }

    // 2. Clone actions associated with those integrations or general actions
    var actions []database.ActionDefinition
    if err := database.DB.Where("tenant_id = 1").Find(&actions).Error; err != nil {
        tx.Rollback()
        return fmt.Errorf("failed to fetch seed actions: %v", err)
    }

    // Map old Action ID -> New Action ID
    actMap := make(map[uint]uint)

    for _, a := range actions {
        newAct := a
        newAct.ID = 0
        newAct.TenantID = uint(tenantID)
        
        // Link to the newly created integration
        if newID, ok := intMap[a.IntegrationID]; ok {
            newAct.IntegrationID = newID
        } else {
             // Fallback: try to find by name if map fails (e.g. if integrations existed before)
            var matchingInt database.Integration
            if tx.Where("tenant_id = ? AND name = ?", tenantID, a.Vendor).First(&matchingInt).Error == nil {
                newAct.IntegrationID = matchingInt.ID
            }
        }

        if err := tx.Create(&newAct).Error; err != nil {
            tx.Rollback()
            return fmt.Errorf("failed to clone action %s: %v", a.Name, err)
        }
        actMap[a.ID] = newAct.ID
    }

    // 3. Clone workflows and steps
    var workflows []database.Workflow
    if err := database.DB.Preload("Steps").Where("tenant_id = 1").Find(&workflows).Error; err != nil {
        tx.Rollback()
        return fmt.Errorf("failed to fetch seed workflows: %v", err)
    }

    for _, w := range workflows {
        newWf := w
        newWf.ID = 0
        newWf.TenantID = uint(tenantID)
        newWf.Steps = nil     // clear steps to re-add manually
        newWf.Enabled = false // Default to disabled
        newWf.AuthMindPollers = nil // Clear pollers association

        if err := tx.Create(&newWf).Error; err != nil {
            tx.Rollback()
            return fmt.Errorf("failed to clone workflow %s: %v", w.Name, err)
        }
        
        // Link Pollers if they match (find AuthMind Poller for new tenant)
        // We assume typical "AuthMind Poller" naming convention
        var newPollers []database.Integration
        if tx.Where("tenant_id = ? AND name LIKE ?", tenantID, "%AuthMind%").Find(&newPollers).Error == nil {
             if err := tx.Model(&newWf).Association("AuthMindPollers").Replace(newPollers); err != nil {
                 // Log warning but don't fail?
             }
        }

        // Clone Steps
        for _, step := range w.Steps {
            newStep := step
            newStep.ID = 0
            newStep.WorkflowID = newWf.ID
            
            // Link to the newly created action
            if newActID, ok := actMap[step.ActionDefinitionID]; ok {
                newStep.ActionDefinitionID = newActID
            } else {
                // Warning: Action not found in map, this step might be broken
                // We could skip or try to look up by name
                 var originalAct database.ActionDefinition
                 database.DB.First(&originalAct, step.ActionDefinitionID)
                 
                 var matchingAct database.ActionDefinition
                 if tx.Where("tenant_id = ? AND name = ?", tenantID, originalAct.Name).First(&matchingAct).Error == nil {
                     newStep.ActionDefinitionID = matchingAct.ID
                 }
            }

            if err := tx.Create(&newStep).Error; err != nil {
                tx.Rollback()
                return fmt.Errorf("failed to clone workflow step: %v", err)
            }
        }
    }

    tx.Commit()
    return nil
}

// GetAggregateStats returns metrics across all tenants (Admin only)
func GetAggregateStats(c *gin.Context) {
	var stats struct {
		TotalJobs       int64            `json:"total_jobs"`
		SuccessJobs     int64            `json:"success_jobs"`
		FailedJobs      int64            `json:"failed_jobs"`
		RunningJobs     int64            `json:"running_jobs"`
		TotalTenants    int64            `json:"total_tenants"`
		ActiveWorkflows int64            `json:"active_workflows"`
		TenantBreakdown []map[string]interface{} `json:"tenant_breakdown"`
	}

	database.DB.Model(&database.Job{}).Count(&stats.TotalJobs)
	database.DB.Model(&database.Job{}).Where("status = ?", "completed").Count(&stats.SuccessJobs)
	database.DB.Model(&database.Job{}).Where("status = ?", "failed").Count(&stats.FailedJobs)
	database.DB.Model(&database.Job{}).Where("status = ?", "running").Count(&stats.RunningJobs)
	database.DB.Model(&database.Tenant{}).Count(&stats.TotalTenants)
	database.DB.Model(&database.Workflow{}).Where("enabled = ?", true).Count(&stats.ActiveWorkflows)

	// Calculate breakdown per tenant
	database.DB.Table("jobs").
		Select("tenants.name as tenant_name, count(jobs.id) as job_count, tenants.id as tenant_id").
		Joins("left join tenants on tenants.id = jobs.tenant_id").
		Group("tenants.id").
		Scan(&stats.TenantBreakdown)

	c.JSON(http.StatusOK, stats)
}