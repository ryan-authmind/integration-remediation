package core

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"remediation-engine/internal/database"
	"remediation-engine/internal/integrations"
	"strconv"
	"sync"
	"time"
)

var GlobalEngine *Engine

// PollingTask represents a unit of work for the worker pool
type PollingTask struct {
    TenantID    uint
    Integration database.Integration
    Workflows   []database.Workflow
}

type Engine struct {
	// Worker Pool
    taskQueue   chan PollingTask
    workerCount int
    wg          sync.WaitGroup

	// Cache for tracking last run per tenant/workflow
    // Map: TenantID -> WorkflowID -> LastRunTime
	lastRun   map[uint]map[uint]time.Time
	lastRunMu sync.Mutex

    // SyncMode forces synchronous execution for testing
    SyncMode bool
}

func NewEngine() *Engine {
	GlobalEngine = &Engine{
        taskQueue:   make(chan PollingTask, 1000), // Buffered channel
        workerCount: 20,                           // Default 20 workers
		lastRun:     make(map[uint]map[uint]time.Time),
	}
    return GlobalEngine
}

func (e *Engine) Start() {
	log.Printf("Starting Workflow Engine (Multi-Tenant Mode) with %d workers...", e.workerCount)
    e.cleanupStaleJobs()

    // Start Workers
    for i := 0; i < e.workerCount; i++ {
        e.wg.Add(1)
        go e.worker(i)
    }

	ticker := time.NewTicker(10 * time.Second) // Check for work every 10s
	retentionTicker := time.NewTicker(24 * time.Hour)
	
	for {
		select {
		case <-ticker.C:
			e.schedulePollingTasks()
		case <-retentionTicker.C:
			e.runRetentionPolicy()
		}
	}
}

func (e *Engine) cleanupStaleJobs() {
    log.Println("[Engine] Cleaning up stale 'running' jobs from previous session...")
    result := database.DB.Model(&database.Job{}).Where("status = ?", "running").Update("status", "failed")
    if result.RowsAffected > 0 {
        log.Printf("[Engine] Marked %d stale jobs as failed.", result.RowsAffected)
    }
}

// worker consumes tasks from the channel and executes polling
func (e *Engine) worker(id int) {
    defer e.wg.Done()
    for task := range e.taskQueue {
        e.pollAuthMind(task)
    }
}

// schedulePollingTasks finds eligible work across ALL tenants
func (e *Engine) schedulePollingTasks() {
    // 1. Fetch all tenants
    var tenants []database.Tenant
    if err := database.DB.Find(&tenants).Error; err != nil {
        log.Printf("[Engine] Failed to fetch tenants: %v", err)
        return
    }

    for _, tenant := range tenants {
        e.scheduleForTenant(tenant)
    }
}

func (e *Engine) scheduleForTenant(tenant database.Tenant) {
    // 1. Fetch enabled AuthMind integrations for this tenant
    var pollers []database.Integration
    if err := database.DB.Where("tenant_id = ? AND enabled = ? AND name LIKE ?", tenant.ID, true, "%AuthMind%").Find(&pollers).Error; err != nil {
        return
    }

    if len(pollers) == 0 {
        return
    }

    e.lastRunMu.Lock()
    defer e.lastRunMu.Unlock()

    if _, ok := e.lastRun[tenant.ID]; !ok {
        e.lastRun[tenant.ID] = make(map[uint]time.Time)
    }

    // 2. For each poller, find workflows specifically associated with it
    for _, poller := range pollers {
        var workflows []database.Workflow
        if err := database.DB.Preload("Steps").Preload("Steps.ActionDefinition").
            Joins("JOIN workflow_pollers ON workflow_pollers.workflow_id = workflows.id").
            Where("workflow_pollers.integration_id = ? AND workflows.enabled = ? AND workflows.tenant_id = ?", poller.ID, true, tenant.ID).
            Find(&workflows).Error; err != nil {
            continue
        }

        // FALLBACK: If no explicit pollers are assigned, we might want to check if the workflow
        // is "Global" for the tenant. But for now, we follow the strict many-to-many requirement.
        if len(workflows) == 0 {
            continue
        }

        interval := time.Duration(poller.PollingInterval) * time.Second
        if interval <= 0 { interval = 60 * time.Second }

        lastRunTime, exists := e.lastRun[tenant.ID][poller.ID]
        if !exists || time.Since(lastRunTime) >= interval {
            e.lastRun[tenant.ID][poller.ID] = time.Now()
            
            task := PollingTask{
                TenantID:    tenant.ID,
                Integration: poller,
                Workflows:   workflows,
            }
            
            if e.SyncMode {
                e.pollAuthMind(task)
            } else {
                select {
                case e.taskQueue <- task:
                default:
                    log.Printf("[Engine] Task queue full, skipping poll for Tenant %d Poller %d", tenant.ID, poller.ID)
                }
            }
        }
    }
}

func (e *Engine) pollAuthMind(task PollingTask) {
	var creds struct{ Token string `json:"token"` }
	json.Unmarshal([]byte(task.Integration.Credentials), &creds)

				sdk := integrations.NewAuthMindSDK(task.Integration.BaseURL, creds.Token)
			
			    // Check state for "last_id_tenant_{id}_integration_{id}"
				stateKey := fmt.Sprintf("last_id_t%d_i%d", task.TenantID, task.Integration.ID)
				var state database.StateStore
				if err := database.DB.Where("key = ?", stateKey).First(&state).Error; err != nil {        state = database.StateStore{Key: stateKey, Value: "0"}
        database.DB.Save(&state) 
    }

    	// Poll for EVERYTHING ("" for type) to be efficient
    	issues, err := sdk.GetIssues("", state.Value)
    	if err != nil {
    		log.Printf("[Engine] Failed to fetch issues for Tenant %d: %v", task.TenantID, err)
    		return
    	}
        
        if len(issues) > 0 {
            log.Printf("[Engine] Tenant %d: Fetched %d new issues from AuthMind (LastID: %s)", task.TenantID, len(issues), state.Value)
        }
    
    	for _, issue := range issues {
    		issueIDStr := issue.IssueID
            log.Printf("[Engine] Tenant %d: Processing Issue %s (Type: %s, Severity: %d)", task.TenantID, issueIDStr, issue.IssueType, issue.Severity)
    
    		userEmail := "Unknown"
    		if issue.IssueKeys != nil {
    			for _, key := range []string{"identity_name", "user_email", "username", "email"} {
    				if val, ok := issue.IssueKeys[key].(string); ok && val != "" {
    					userEmail = val
    					break
    				}
    			}
    		}
    
    		// Identify matching workflows
    		var workflowsToRun []database.Workflow
            issueSevScore := issue.Severity
    
    		for _, wf := range task.Workflows {
    			// Check Name Match
                if wf.Name != issue.IssueType && wf.Name != "All" {
                    // log.Printf("[Engine] Skipping WF '%s' - Name mismatch", wf.Name)
                    continue
                }
                
                // Check Severity
                wfSevScore := e.severityStringToInt(wf.MinSeverity)
                if issueSevScore < wfSevScore {
                    log.Printf("[Engine] Skipping WF '%s' - Severity too low (Issue: %d < WF: %d)", wf.Name, issueSevScore, wfSevScore)
                    continue
                }
    
                workflowsToRun = append(workflowsToRun, wf)
    		}
    
    		if len(workflowsToRun) > 0 {
    			details, err := sdk.GetIssueDetails(issueIDStr)
    			if err != nil {
    				log.Printf("[Engine] Warning: Failed to fetch details for issue %s: %v", issueIDStr, err)
    				details = &integrations.IssueDetails{Results: []integrations.IssueDetailItem{{Message: "Details unavailable (API Error)", Risk: "Unknown"}}}
    			}
    
    			contextData := map[string]interface{}{
                    "TenantID":      task.TenantID, // Inject TenantID into context
    				"IssueID":       issueIDStr,
    				"UserEmail":     userEmail,
    				"Timestamp":     time.Now().Format(time.RFC3339),
    				"Severity":      issue.Severity,
    				"Risk":          issue.Risk,
    				"PlaybookName":  issue.PlaybookName,
    				"IssueMessage":  issue.Message,
    				"FlowCount":     issue.FlowCount,
    				"IncidentCount": issue.IncidentCount,
    				"IncidentsURL":  issue.IncidentsURL,
    				"Details":       details,
    				"IssueType":     issue.IssueType,
    				"IssueKeys":     issue.IssueKeys,
    				"FirstSeen":     issue.IssueTime,
    			}
    			
    			for _, runWf := range workflowsToRun {
                    log.Printf("[Engine] Tenant %d: Queuing execution for WF '%s' on Issue %s", task.TenantID, runWf.Name, issueIDStr)
    				e.RunWorkflow(runWf, contextData)
    			}
    		} else {
                log.Printf("[Engine] Tenant %d: No matching workflows found for Issue %s", task.TenantID, issueIDStr)
            }
    		state.Value = issueIDStr
    		database.DB.Save(&state)
    	}
    }
    
    func (e *Engine) severityStringToInt(sev string) int {
        switch sev {
        case "Critical": return 4
        case "High": return 3
        case "Medium": return 2
        case "Low": return 1
        default: return 1
        }
    }
    
    func (e *Engine) RunWorkflow(wf database.Workflow, triggerContext map[string]interface{}) {
    	issueID := fmt.Sprintf("%v", triggerContext["IssueID"])
        tenantID := triggerContext["TenantID"].(uint)
    	
    	contextJSON, _ := json.Marshal(triggerContext)
    
    	job := database.Job{
            TenantID:        tenantID,
    		WorkflowID:      wf.ID,
    		AuthMindIssueID: issueID,
    		Status:          "running",
    		TriggerContext:  string(contextJSON),
    	}
    
        var existing int64
        database.DB.Model(&database.Job{}).
            Where("tenant_id = ? AND workflow_id = ? AND auth_mind_issue_id = ?", tenantID, wf.ID, issueID).
            Count(&existing)
            
        if existing > 0 && triggerContext["ManualRerun"] != true {
            log.Printf("[Engine] Job skipped: Duplicate execution for Tenant %d, WF %d, Issue %s", tenantID, wf.ID, issueID)
            return
        }
	if err := database.DB.Create(&job).Error; err != nil {
		if triggerContext["ManualRerun"] == true {
			job.AuthMindIssueID = fmt.Sprintf("%s-rerun-%d", issueID, time.Now().Unix())
			database.DB.Create(&job)
		} else {
			return 
		}
	}

	log.Printf("[Tenant:%d][Workflow:%s] Executing Workflow for %v (Issue:%s)", tenantID, wf.Name, triggerContext["UserEmail"], issueID)

	lang := "en"
	if val, ok := triggerContext["Language"].(string); ok {
		lang = val
	}

	templateIssueType := wf.Name
	if it, ok := triggerContext["IssueType"].(string); ok && it != "" {
		templateIssueType = it
	}

	var msgTemplate database.MessageTemplate
	database.DB.Where("issue_type = ? AND language = ?", templateIssueType, lang).First(&msgTemplate)
	if msgTemplate.ID == 0 && lang != "en" {
		database.DB.Where("issue_type = ? AND language = ?", templateIssueType, "en").First(&msgTemplate)
	}

	executor := NewExecutorFunc()
	success := true

	for _, step := range wf.Steps {
		// 1. Fetch Action Definition (Scoped by Tenant)
		var actionDef database.ActionDefinition
		if err := database.DB.Where("id = ? AND tenant_id = ?", step.ActionDefinitionID, tenantID).First(&actionDef).Error; err != nil {
			e.logToJob(job.ID, "ERROR", fmt.Sprintf("Failed to find action definition %d for tenant %d: %v", step.ActionDefinitionID, tenantID, err))
			success = false
			break
		}

		// 2. Fetch Integration (Scoped by Tenant)
		var integration database.Integration
		if err := database.DB.Where("id = ? AND tenant_id = ?", actionDef.IntegrationID, tenantID).First(&integration).Error; err != nil {
			e.logToJob(job.ID, "ERROR", fmt.Sprintf("Failed to find integration %d for tenant %d: %v", actionDef.IntegrationID, tenantID, err))
			success = false
			break
		}

		if !integration.Enabled {
			e.logToJob(job.ID, "WARN", fmt.Sprintf("Integration %s is disabled, skipping step", integration.Name))
			continue
		}

		contextData := make(map[string]interface{})
		for k, v := range triggerContext {
			contextData[k] = v
		}

		contextData["Title"] = msgTemplate.Title
		contextData["Message"] = msgTemplate.Message
		contextData["Footer"] = msgTemplate.Footer

		var stepParams map[string]interface{}
		json.Unmarshal([]byte(step.ParameterMapping), &stepParams)
		for k, v := range stepParams {
			contextData[k] = v
		}

		resp, code, err := executor.Execute(integration, actionDef, contextData)
		if err != nil {
			e.logToJob(job.ID, "ERROR", fmt.Sprintf("Step %d (%s) failed (Status: %d): %v", step.Order, actionDef.Name, code, err))
			success = false
			break
		}
		
		logMsg := fmt.Sprintf("Step %d (%s) completed successfully (Status: %d)", step.Order, actionDef.Name, code)
		if len(resp) > 0 {
			var pretty bytes.Buffer
			if err := json.Indent(&pretty, resp, "", "  "); err == nil {
				logMsg += fmt.Sprintf("\nResponse: %s", pretty.String())
			} else {
				logMsg += fmt.Sprintf("\nResponse: %s", string(resp))
			}
		}
		e.logToJob(job.ID, "INFO", logMsg)
	}

	finalStatus := "completed"
	if !success {
		finalStatus = "failed"
	}
	database.DB.Model(&job).Update("status", finalStatus)
}

func (e *Engine) logToJob(jobID uint, level string, msg string) {
	database.DB.Create(&database.JobLog{
		JobID:     jobID,
		Timestamp: time.Now(),
		Level:     level,
		Message:   msg,
	})
}

func (e *Engine) runRetentionPolicy() {
	var setting database.SystemSetting
	if err := database.DB.Where("key = ?", "data_retention_days").First(&setting).Error; err != nil {
		return
	}

	days, err := strconv.Atoi(setting.Value)
	if err != nil || days <= 0 {
		return
	}

	cutoff := time.Now().AddDate(0, 0, -days)
	log.Printf("[Retention] Running cleanup for data older than %d days (Cutoff: %v)...", days, cutoff)

	database.DB.Exec("DELETE FROM job_logs WHERE job_id IN (SELECT id FROM jobs WHERE created_at < ?)", cutoff)
	result := database.DB.Unscoped().Where("created_at < ?", cutoff).Delete(&database.Job{})
	log.Printf("[Retention] Cleanup complete. Removed %d job records.", result.RowsAffected)
	database.DB.Exec("VACUUM")
}
