package database

import (
	"log"
	"remediation-engine/internal/security"
    "regexp"
    "strconv"
    "strings"

	"gorm.io/gorm"
)

// MigrateJobLogs backfills structured data from existing message strings
func MigrateJobLogs(db *gorm.DB) error {
    log.Println("[Database] Checking for unstructured job logs...")

    var logs []JobLog
    // Find logs that have a message but haven't been structured yet
    err := db.Where("message <> '' AND step_name = '' AND status_code = 0").Find(&logs).Error
    if err != nil {
        return err
    }

    if len(logs) == 0 {
        return nil
    }

    log.Printf("[Database] Migrating %d job logs to structured format...", len(logs))

    // Regex patterns for parsing legacy messages
    // Example: "Step 0 (Slack Notification) completed successfully (Status: 200)"
    // Also handle: "Failed to find action definition 1..." or other system logs
    stepNameRegex := regexp.MustCompile(`Step \d+ \((.*?)\)`)
    statusCodeRegex := regexp.MustCompile(`\(Status: (\d+)\)`)

    for i := range logs {
        l := &logs[i]
        
        // 1. Extract Step Name
        nameMatch := stepNameRegex.FindStringSubmatch(l.Message)
        if len(nameMatch) > 1 {
            l.StepName = nameMatch[1]
        } else {
            // Fallback for non-step logs (e.g. system errors)
            if strings.Contains(l.Message, "Failed to find") {
                l.StepName = "System Error"
            } else if strings.Contains(l.Message, "Integration") && strings.Contains(l.Message, "disabled") {
                l.StepName = "Integration Check"
            } else {
                l.StepName = "Process"
            }
        }

        // 2. Extract Status Code
        codeMatch := statusCodeRegex.FindStringSubmatch(l.Message)
        if len(codeMatch) > 1 {
            code, _ := strconv.Atoi(codeMatch[1])
            l.StatusCode = code
        }

        // 3. Extract Response Body
        if strings.Contains(l.Message, "\nResponse: ") {
            parts := strings.Split(l.Message, "\nResponse: ")
            l.ResponseBody = parts[1]
        } else if strings.Contains(l.Message, "\nResponse Body: ") {
             parts := strings.Split(l.Message, "\nResponse Body: ")
             l.ResponseBody = parts[1]
        }

        // Save back
        if err := db.Save(l).Error; err != nil {
            log.Printf("Failed to migrate log %d: %v", l.ID, err)
        }
    }

    log.Println("[Database] Job log migration complete.")
    return nil
}

// MigrateLegacyCredentials upgrades legacy encrypted data to the new format
func MigrateLegacyCredentials(db *gorm.DB) error {
	log.Println("[Database] Checking for legacy encryption...")

	// 1. Migrate Integrations
	var integrationIDs []uint
	// Find records that have credentials but lack the new prefix
	err := db.Table("integrations").
		Where("credentials <> '' AND credentials NOT LIKE ?", security.EncryptedPrefix+"%").
		Pluck("id", &integrationIDs).Error
	
	if err != nil {
		return err
	}

	if len(integrationIDs) > 0 {
		log.Printf("[Database] Migrating %d integrations...", len(integrationIDs))
		for _, id := range integrationIDs {
			var integ Integration
			// Load: Triggers AfterFind -> Decrypts legacy
			if err := db.First(&integ, id).Error; err != nil {
				log.Printf("Failed to load integration %d: %v", id, err)
				continue
			}
			// Save: Triggers BeforeSave -> Encrypts with new prefix
			if err := db.Save(&integ).Error; err != nil {
				log.Printf("Failed to migrate integration %d: %v", id, err)
			}
		}
	}

	// 2. Migrate Tenants (API Keys)
	var tenantIDs []uint
	err = db.Table("tenants").
		Where("api_key <> '' AND api_key NOT LIKE ?", security.EncryptedPrefix+"%").
		Pluck("id", &tenantIDs).Error
	
	if err != nil {
		return err
	}

	if len(tenantIDs) > 0 {
		log.Printf("[Database] Migrating %d tenants...", len(tenantIDs))
		for _, id := range tenantIDs {
			var t Tenant
			if err := db.First(&t, id).Error; err != nil {
				log.Printf("Failed to load tenant %d: %v", id, err)
				continue
			}
			if err := db.Save(&t).Error; err != nil {
				log.Printf("Failed to migrate tenant %d: %v", id, err)
			}
		}
	}

	return nil
}
