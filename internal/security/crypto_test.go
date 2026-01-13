package security

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestEncryptionCycle(t *testing.T) {
	os.Setenv("ENCRYPTION_KEY", "12345678901234567890123456789012") // 32 bytes

	original := "secret_password"
	encrypted, err := Encrypt(original)
	assert.NoError(t, err)
	assert.NotEqual(t, original, encrypted)

	decrypted, err := Decrypt(encrypted)
	assert.NoError(t, err)
	assert.Equal(t, original, decrypted)
}

func TestGetEncryptionKey_Fallback(t *testing.T) {
	os.Unsetenv("ENCRYPTION_KEY")
	key := GetEncryptionKey()
	assert.NotEmpty(t, key)
	assert.Len(t, key, 32)
}
