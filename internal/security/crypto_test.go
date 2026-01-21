package security

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMain(m *testing.M) {
	// Setup: Ensure env var is set for tests
	os.Setenv("ENCRYPTION_KEY", "12345678901234567890123456789012")
	code := m.Run()
	os.Exit(code)
}

func TestEncryptionCycle(t *testing.T) {
	original := "secret_password"
	encrypted, err := Encrypt(original)
	assert.NoError(t, err)
	assert.NotEqual(t, original, encrypted)
	assert.True(t, strings.HasPrefix(encrypted, EncryptedPrefix))

	decrypted, err := Decrypt(encrypted)
	assert.NoError(t, err)
	assert.Equal(t, original, decrypted)
}

func TestDecrypt_LegacySupport(t *testing.T) {
	// Simulate legacy encryption (no prefix)
	key := GetEncryptionKey()
	block, _ := aes.NewCipher(key)
	gcm, _ := cipher.NewGCM(block)
	nonce := make([]byte, gcm.NonceSize())
	io.ReadFull(rand.Reader, nonce)
	original := "legacy_secret"
	ciphertext := gcm.Seal(nonce, nonce, []byte(original), nil)
	legacyBase64 := base64.StdEncoding.EncodeToString(ciphertext)

	// Attempt decrypt
	decrypted, err := Decrypt(legacyBase64)
	assert.NoError(t, err)
	assert.Equal(t, original, decrypted)
}

func TestDecrypt_Invalid(t *testing.T) {
	// Case 1: Plain text / Garbage
	_, err := Decrypt("plain_text_password")
	assert.Error(t, err)

	// Case 2: Wrong prefix
	_, err = Decrypt("enc:v0:somebase64")
	assert.Error(t, err)

	// Case 3: Valid prefix but invalid base64
	_, err = Decrypt(EncryptedPrefix + "not_base_64")
	assert.Error(t, err)
}

func TestEncrypt_Idempotency(t *testing.T) {
	original := "secret_data"
	enc1, _ := Encrypt(original)
	
	// Encrypting the encrypted string should return the same string
	enc2, err := Encrypt(enc1)
	assert.NoError(t, err)
	assert.Equal(t, enc1, enc2)
}

func TestDecrypt_WrongKey(t *testing.T) {
	original := "my_secret"
	encrypted, _ := Encrypt(original)

	// Change key
	os.Setenv("ENCRYPTION_KEY", "00000000000000000000000000000000")
	defer os.Setenv("ENCRYPTION_KEY", "12345678901234567890123456789012") // Restore

	_, err := Decrypt(encrypted)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "decryption failed")
}