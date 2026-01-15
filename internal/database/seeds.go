package database

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"

	"gorm.io/gorm"
)

// SeedDatabase loads seed data from JSON files if the database is empty
func SeedDatabase(db *gorm.DB, seedDir string) {
	log.Printf("[Seed] Checking if database needs seeding from %s...", seedDir)

	// 1. Check if we already have tenants
	var tenantCount int64
	db.Model(&Tenant{}).Count(&tenantCount)
	if tenantCount > 0 {
		log.Println("[Seed] Database already contains data. Skipping initial seeding to prevent overwriting.")
		return
	}

	// 2. Load and seed Tenants
	var tenants []Tenant
	if err := loadSeedFile(seedDir, "tenants.json", &tenants); err == nil {
		for _, t := range tenants {
			db.Create(&t)
		}
		log.Printf("[Seed] Seeded %d tenants.", len(tenants))
	}

	// 3. Load and seed Integrations
	var integrations []Integration
	if err := loadSeedFile(seedDir, "integrations.json", &integrations); err == nil {
		for _, i := range integrations {
			db.Create(&i)
		}
		log.Printf("[Seed] Seeded %d integrations.", len(integrations))
	}

	// 4. Load and seed Action Definitions
	// Special handling: we might need to resolve integration IDs if they aren't static
	var actions []struct {
		ActionDefinition
		IntegrationName string `json:"integration_name"`
	}
	if err := loadSeedFile(seedDir, "actions.json", &actions); err == nil {
		for _, a := range actions {
			if a.IntegrationID == 0 && a.IntegrationName != "" {
				var integ Integration
				db.Where("name = ? AND tenant_id = ?", a.IntegrationName, a.TenantID).First(&integ)
				a.ActionDefinition.IntegrationID = integ.ID
			}
			db.Create(&a.ActionDefinition)
		}
		log.Printf("[Seed] Seeded %d action definitions.", len(actions))
	}

	// 5. Load and seed Workflows
	var workflows []Workflow
	if err := loadSeedFile(seedDir, "workflows.json", &workflows); err == nil {
		for _, w := range workflows {
			db.Create(&w)
		}
		log.Printf("[Seed] Seeded %d workflows.", len(workflows))
	}

	// 6. Load and seed Settings
	var settings []SystemSetting
	if err := loadSeedFile(seedDir, "settings.json", &settings); err == nil {
		for _, s := range settings {
			db.Create(&s)
		}
		log.Printf("[Seed] Seeded %d system settings.", len(settings))
	}

	// 7. Load and seed Message Templates
	var templates []MessageTemplate
	if err := loadSeedFile(seedDir, "templates.json", &templates); err == nil {
		for _, t := range templates {
			db.Create(&t)
		}
		log.Printf("[Seed] Seeded %d message templates.", len(templates))
	}

    // 8. Special Case: Seed Default Steps for core workflows if they don't exist
    seedDefaultWorkflowSteps(db)

	log.Println("[Seed] Database seeding complete.")
}

func loadSeedFile(dir, filename string, target interface{}) error {
	path := filepath.Join(dir, filename)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return err
		}
		log.Printf("[Seed ERROR] Failed to read %s: %v", filename, err)
		return err
	}
	return json.Unmarshal(data, target)
}

func seedDefaultWorkflowSteps(db *gorm.DB) {
    // This logic ensures that even with JSON seeds, the complex relationships 
    // (steps for 'All' and 'Compromised User') are established correctly.
    
    var wfAll Workflow
    db.Where("name = ? AND tenant_id = ?", "All", 1).First(&wfAll)
    
    var wfCompromised Workflow
    db.Where("name = ? AND tenant_id = ?", "Compromised User", 1).First(&wfCompromised)

    // Helper to find action by name
    findAct := func(name string) uint {
        var a ActionDefinition
        db.Where("name = ? AND tenant_id = ?", name, 1).First(&a)
        return a.ID
    }

    if wfAll.ID != 0 {
        var count int64
        db.Model(&WorkflowStep{}).Where("workflow_id = ?", wfAll.ID).Count(&count)
        if count == 0 {
            steps := []WorkflowStep{
                {WorkflowID: wfAll.ID, ActionDefinitionID: findAct("Disable AD User"), Order: 1},
                {WorkflowID: wfAll.ID, ActionDefinitionID: findAct("Suspend Okta User"), Order: 2},
                {WorkflowID: wfAll.ID, ActionDefinitionID: findAct("Notify Security Slack"), Order: 3},
            }
            for _, s := range steps { if s.ActionDefinitionID != 0 { db.Create(&s) } }
        }
    }

    if wfCompromised.ID != 0 {
        var count int64
        db.Model(&WorkflowStep{}).Where("workflow_id = ?", wfCompromised.ID).Count(&count)
        if count == 0 {
            steps := []WorkflowStep{
                {WorkflowID: wfCompromised.ID, ActionDefinitionID: findAct("Disable AD User"), Order: 1},
                {WorkflowID: wfCompromised.ID, ActionDefinitionID: findAct("Suspend Okta User"), Order: 2},
                {WorkflowID: wfCompromised.ID, ActionDefinitionID: findAct("Revoke Okta Sessions"), Order: 3},
                {WorkflowID: wfCompromised.ID, ActionDefinitionID: findAct("Force AD Password Change"), Order: 4},
                {WorkflowID: wfCompromised.ID, ActionDefinitionID: findAct("Notify Security Slack"), Order: 5},
            }
            for _, s := range steps { if s.ActionDefinitionID != 0 { db.Create(&s) } }
        }
    }
}

// Deprecated: SeedWorkflows is kept for backward compatibility if needed, 
// but SeedDatabase is preferred now.
func SeedWorkflows(db *gorm.DB) {
    SeedDatabase(db, "data/seeds")
}