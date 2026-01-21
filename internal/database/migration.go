package database

import (
	"log"
	"remediation-engine/internal/security"

	"gorm.io/gorm"
)

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
