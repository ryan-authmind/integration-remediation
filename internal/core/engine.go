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

type Engine struct {
	// track last run per workflow ID to manage individual frequencies
	lastRun   map[uint]time.Time
	lastRunMu sync.Mutex
	
	// Cache for trigger integration to reduce DB load
	amIntegration *database.Integration
	amLastFetch   time.Time

	// Cached workflows to prevent per-second DB hits
	cachedWorkflows []database.Workflow
	cacheMu         sync.RWMutex
	lastCacheSync   time.Time

    // SyncMode forces synchronous execution for testing
    SyncMode bool
}

func NewEngine() *Engine {
	GlobalEngine = &Engine{
		lastRun: make(map[uint]time.Time),
	}
    return GlobalEngine
}

func (e *Engine) Start() {
	log.Println("Starting Workflow Engine (Master Poller Mode enabled)...")
	e.syncCache()

	ticker := time.NewTicker(1 * time.Second)
	cacheTicker := time.NewTicker(1 * time.Minute)
	retentionTicker := time.NewTicker(24 * time.Hour) // Run retention daily
	
	for {
		select {
		case <-ticker.C:
			e.executeEligibleWorkflows()
		case <-cacheTicker.C:
			e.syncCache()
		case <-retentionTicker.C:
			e.runRetentionPolicy()
		}
	}
}

func (e *Engine) syncCache() {
	e.cacheMu.Lock()
	defer e.cacheMu.Unlock()

	var integration database.Integration
	if err := database.DB.Where("name = ?", "AuthMind API").First(&integration).Error; err == nil {
		e.amIntegration = &integration
		e.amLastFetch = time.Now()
	}

	var workflows []database.Workflow
	err := database.DB.Preload("Steps").Preload("Steps.ActionDefinition").
		Where("enabled = ? AND trigger_type = ?", true, "AUTHMIND_POLL").
		Find(&workflows).Error

	if err != nil {
		log.Printf("[Engine] Cache sync failed: %v", err)
		return
	}

	e.cachedWorkflows = workflows
	e.lastCacheSync = time.Now()
}

func (e *Engine) executeEligibleWorkflows() {
	e.cacheMu.RLock()
	workflows := make([]database.Workflow, len(e.cachedWorkflows))
	copy(workflows, e.cachedWorkflows)
	am := e.amIntegration
	e.cacheMu.RUnlock()

	if am == nil || !am.Enabled {
		return
	}

	interval := time.Duration(am.PollingInterval) * time.Second
	if interval <= 0 {
		interval = 60 * time.Second
	}

    e.lastRunMu.Lock()
    defer e.lastRunMu.Unlock()

    // 1. Identify if we have an "All" workflow enabled
    var allWf *database.Workflow
    for i := range workflows {
        if workflows[i].Name == "All" {
            allWf = &workflows[i]
            break
        }
    }

    // 2. Optimization: If "All" is present, it handles polling for everything
    if allWf != nil {
        last, exists := e.lastRun[allWf.ID]
        if !exists || time.Since(last) >= interval {
            if e.SyncMode {
                e.pollAuthMind(*allWf, am)
            } else {
                go e.pollAuthMind(*allWf, am)
            }
            e.lastRun[allWf.ID] = time.Now()
            
            // Mark all other workflows as "last run now" to prevent them from polling redundantly
            for _, wf := range workflows {
                if wf.Name != "All" {
                    e.lastRun[wf.ID] = time.Now()
                }
            }
        }
        return
    }

    // 3. Fallback: Standard individual polling if no "All" workflow exists
	for _, wf := range workflows {
		last, exists := e.lastRun[wf.ID]
		if !exists || time.Since(last) >= interval {
            if e.SyncMode {
                e.pollAuthMind(wf, am)
            } else {
                go e.pollAuthMind(wf, am)
            }
			e.lastRun[wf.ID] = time.Now()
		}
	}
}

func (e *Engine) pollAuthMind(pollerWf database.Workflow, am *database.Integration) {
	var creds struct{ Token string `json:"token"` }
	json.Unmarshal([]byte(am.Credentials), &creds)

	sdk := integrations.NewAuthMindSDK(am.BaseURL, creds.Token)

	stateKey := "last_id_" + pollerWf.Name
	var state database.StateStore
    
    // ATOMIC INIT: Avoid UNIQUE constraint race
	if err := database.DB.Where("key = ?", stateKey).First(&state).Error; err != nil {
        state = database.StateStore{Key: stateKey, Value: "0"}
        database.DB.Save(&state) 
    }

	issues, err := sdk.GetIssues(pollerWf.Name, state.Value)
	if err != nil {
		log.Printf("[Engine] Failed to fetch issues for %s: %v", pollerWf.Name, err)
		return
	}

	for _, issue := range issues {
		issueIDStr := issue.IssueID
		// 1. Resolve Identity (UserEmail) with fallbacks
		userEmail := "Unknown"
		if issue.IssueKeys != nil {
			// Try common identity keys
			for _, key := range []string{"identity_name", "user_email", "username", "email"} {
				if val, ok := issue.IssueKeys[key].(string); ok && val != "" {
					userEmail = val
					break
				}
			}
		}

		// 2. Identify which workflows should process this specific issue
		var workflowsToRun []database.Workflow
		
		e.cacheMu.RLock()
		for _, cachedWf := range e.cachedWorkflows {
			if cachedWf.Name == issue.IssueType || cachedWf.Name == "All" {
				workflowsToRun = append(workflowsToRun, cachedWf)
			}
		}
		e.cacheMu.RUnlock()

		if len(workflowsToRun) > 0 {
			details, err := sdk.GetIssueDetails(issueIDStr)
			if err != nil {
				log.Printf("[Engine] Warning: Failed to fetch details for issue %s: %v. Proceeding with basic info.", issueIDStr, err)
				details = &integrations.IssueDetails{
					Results: []integrations.IssueDetailItem{
						{Message: "Details unavailable (API Error)", Risk: "Unknown"},
					},
				}
			}

			contextData := map[string]interface{}{
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
				"FirstSeen":     issue.IssueTime, // Map IssueTime to FirstSeen
			}
			
			for _, runWf := range workflowsToRun {
				e.RunWorkflow(runWf, contextData)
			}
		}
		state.Value = issueIDStr
		database.DB.Save(&state)
	}
}

func (e *Engine) RunWorkflow(wf database.Workflow, triggerContext map[string]interface{}) {
	issueID := fmt.Sprintf("%v", triggerContext["IssueID"])
	
	contextJSON, _ := json.Marshal(triggerContext)

	job := database.Job{
		WorkflowID:      wf.ID,
		AuthMindIssueID: issueID,
		Status:          "running",
		TriggerContext:  string(contextJSON),
	}

    var existing int64
    database.DB.Model(&database.Job{}).Where("workflow_id = ? AND auth_mind_issue_id = ?", wf.ID, issueID).Count(&existing)
    if existing > 0 && triggerContext["ManualRerun"] != true {
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

	log.Printf("[Workflow:%s] Executing Remediation for %v (Issue:%s)", wf.Name, triggerContext["UserEmail"], issueID)

	lang := "en"
	if val, ok := triggerContext["Language"].(string); ok {
		lang = val
	}

	// Resolve the issue type for template lookup (use context if available, otherwise workflow name)
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
		// 1. Fetch the Action Definition to get the latest IntegrationID
		var actionDef database.ActionDefinition
		if err := database.DB.First(&actionDef, step.ActionDefinitionID).Error; err != nil {
			e.logToJob(job.ID, "ERROR", fmt.Sprintf("Failed to find action definition %d: %v", step.ActionDefinitionID, err))
			success = false
			break
		}

		// 2. Fetch the Integration
		var integration database.Integration
		if err := database.DB.First(&integration, actionDef.IntegrationID).Error; err != nil {
			e.logToJob(job.ID, "ERROR", fmt.Sprintf("Failed to find integration %d: %v", actionDef.IntegrationID, err))
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
			// Try to pretty print JSON for the log
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

	// 1. Delete Logs first (Foreign Key constraint usually handles this but being explicit is safer)
	database.DB.Exec("DELETE FROM job_logs WHERE job_id IN (SELECT id FROM jobs WHERE created_at < ?)", cutoff)

	// 2. Delete Jobs
	result := database.DB.Unscoped().Where("created_at < ?", cutoff).Delete(&database.Job{})
	log.Printf("[Retention] Cleanup complete. Removed %d job records.", result.RowsAffected)

	// 3. Optimize DB size
	database.DB.Exec("VACUUM")
}