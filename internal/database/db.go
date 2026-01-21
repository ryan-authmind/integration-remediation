package database

import (
	"log"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(dbPath string) {
	// Ensure directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Fatalf("Failed to create database directory: %v", err)
	}

	// Connect to SQLite
	// specific config for performance/concurrency
	dsn := dbPath + "?_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=foreign_keys(1)"
	
	var err error
	DB, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Disable foreign keys during migration to allow table recreation
	DB.Exec("PRAGMA foreign_keys = OFF")

	// Auto-Migrate Schema
	err = DB.AutoMigrate(
        &Tenant{},
		&Integration{},
		&ActionDefinition{},
		&Workflow{},
		&WorkflowStep{},
		&Job{},
		&JobLog{},
		&ProcessedEvent{},
		&StateStore{},
		&MessageTemplate{},
		&SystemSetting{},
		&RemediationRecommendation{},
	)

	// Re-enable foreign keys
	DB.Exec("PRAGMA foreign_keys = ON")

	if err != nil {
		log.Fatalf("Failed to migrate database schema: %v", err)
	}

	// Run data migrations (e.g. legacy encryption upgrade)
	if err := MigrateLegacyCredentials(DB); err != nil {
		log.Printf("[Database] Warning: Data migration failed: %v", err)
	}

	log.Println("Database initialized and schema migrated successfully.")
}
