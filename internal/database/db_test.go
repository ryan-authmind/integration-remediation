package database

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntegrationHooks(t *testing.T) {
	// Setup env for crypto
	os.Setenv("ENCRYPTION_KEY", "12345678901234567890123456789012")

	InitDB(":memory:")

	// Create a Tenant first to satisfy FK constraint
	tenant := Tenant{Name: "Test Tenant", Description: "For Unit Tests"}
	err := DB.Create(&tenant).Error
	require.NoError(t, err)
	
	// Create integration with sensitive data
	creds := `{"password":"secret"}`
	integ := Integration{
		Name:        "Secure Service",
		Credentials: creds,
		TenantID:    tenant.ID,
	}
	
	err = DB.Create(&integ).Error
	require.NoError(t, err)

	// Verify it's stored encrypted (by raw SQL or by checking value before AfterFind runs if possible, but AfterFind runs on query)
	// Actually, GORM hooks modify the struct in place.
	// To check encryption, we'd need to bypass GORM's hook or read raw.
	
	// Read back (AfterFind should decrypt)
	var readBack Integration
	err = DB.First(&readBack, integ.ID).Error
	assert.NoError(t, err)
	assert.Equal(t, creds, readBack.Credentials)

	// To prove it was encrypted, we can select raw string if we want, but testing the roundtrip is usually sufficient for coverage.
	// But to ensure BeforeSave ran, we should see that it's NOT the plain text in DB if we look directly?
	// Hard to do with GORM easily without raw SQL.
	
	var rawCreds string
	DB.Raw("SELECT credentials FROM integrations WHERE id = ?", integ.ID).Scan(&rawCreds)
	assert.NotEqual(t, creds, rawCreds)
	assert.NotContains(t, rawCreds, "password")
}
