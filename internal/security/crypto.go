package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"io"
	"os"
)

// GetEncryptionKey retrieves the master key and ensures it is exactly 32 bytes
func GetEncryptionKey() []byte {
	key := os.Getenv("ENCRYPTION_KEY")
	if len(key) == 0 {
		key = "a-very-secret-key-32-characters-" // fallback 32 chars
	}
	
	byteKey := []byte(key)
	if len(byteKey) > 32 {
		return byteKey[:32]
	}
	if len(byteKey) < 32 {
		// Pad with zeros if too short
		padded := make([]byte, 32)
		copy(padded, byteKey)
		return padded
	}
	return byteKey
}

// Encrypt string to base64
func Encrypt(text string) (string, error) {
	key := GetEncryptionKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	plaintext := []byte(text)
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt base64 to string. Returns original string if decryption fails (for legacy data support).
func Decrypt(cryptoText string) (string, error) {
	if cryptoText == "" {
		return "", nil
	}

	key := GetEncryptionKey()
	ciphertext, err := base64.StdEncoding.DecodeString(cryptoText)
	if err != nil {
		// Not valid base64, likely legacy plain text
		return cryptoText, nil
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return cryptoText, nil
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return cryptoText, nil
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return cryptoText, nil
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		// Decryption failed (e.g. wrong key or not encrypted), return original
		return cryptoText, nil
	}

	return string(plaintext), nil
}
