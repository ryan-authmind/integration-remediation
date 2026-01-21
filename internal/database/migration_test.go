package database

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"io"
	"os"
	"remediation-engine/internal/security"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigrateLegacyCredentials(t *testing.T) {
	// Setup env
	os.Setenv("ENCRYPTION_KEY", "12345678901234567890123456789012")
	InitDB(":memory:")

	// 1. Create Legacy Data (Manual encryption without prefix)
	key := security.GetEncryptionKey()
	block, _ := aes.NewCipher(key)
	gcm, _ := cipher.NewGCM(block)
	nonce := make([]byte, gcm.NonceSize())
	io.ReadFull(rand.Reader, nonce)
	originalSecret := "legacy-password-123"
	ciphertext := gcm.Seal(nonce, nonce, []byte(originalSecret), nil)
	legacyBase64 := base64.StdEncoding.EncodeToString(ciphertext)

	// Insert via raw SQL to bypass GORM hooks (which would encrypt it properly)
	// We insert a dummy tenant first
	tenant := Tenant{Name: "Migration Test Tenant"}
	DB.Create(&tenant)
	
	// Insert integration with legacy creds
	err := DB.Exec("INSERT INTO integrations (tenant_id, name, credentials) VALUES (?, ?, ?)", 
		tenant.ID, "Legacy Int", legacyBase64).Error
	require.NoError(t, err)

	// Verify it was inserted as legacy (no prefix)
	var rawCreds string
	DB.Raw("SELECT credentials FROM integrations WHERE name = ?", "Legacy Int").Scan(&rawCreds)
	assert.False(t, strings.HasPrefix(rawCreds, security.EncryptedPrefix))

	// 2. Run Migration
	err = MigrateLegacyCredentials(DB)
	assert.NoError(t, err)

	// 3. Verify it is now migrated (has prefix)
	DB.Raw("SELECT credentials FROM integrations WHERE name = ?", "Legacy Int").Scan(&rawCreds)
	assert.True(t, strings.HasPrefix(rawCreds, security.EncryptedPrefix))

	// 4. Verify it can still be decrypted (via Model load)
	var integ Integration
	err = DB.Where("name = ?", "Legacy Int").First(&integ).Error
	assert.NoError(t, err)
	assert.Equal(t, originalSecret, integ.Credentials)
}
