package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"os"
	"strings"
)

const EncryptedPrefix = "enc:v1:"

// GetEncryptionKey retrieves the master key and ensures it is exactly 32 bytes
func GetEncryptionKey() []byte {
	key := os.Getenv("ENCRYPTION_KEY")
	if len(key) == 0 {
		log.Fatal("CRITICAL: ENCRYPTION_KEY environment variable is not set. Security compromised.")
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

// Encrypt string to base64 with prefix
func Encrypt(text string) (string, error) {
	if text == "" {
		return "", nil
	}
	// Prevent double encryption
	if strings.HasPrefix(text, EncryptedPrefix) {
		return text, nil
	}

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
	return EncryptedPrefix + base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt base64 to string. Returns error if decryption fails.
func Decrypt(cryptoText string) (string, error) {
	if cryptoText == "" {
		return "", nil
	}

	// 1. Versioned Prefix (Strict Mode)
	if strings.HasPrefix(cryptoText, EncryptedPrefix) {
		cleanText := strings.TrimPrefix(cryptoText, EncryptedPrefix)
		return decryptRaw(cleanText)
	}

	// 2. Legacy Support (No Prefix)
	// Attempt to decrypt as legacy format.
	// If it fails, we return the error (Fail Secure), we do NOT return the original text.
	return decryptRaw(cryptoText)
}

// decryptRaw performs the actual AES-GCM decryption on a base64 string
func decryptRaw(base64Text string) (string, error) {
	key := GetEncryptionKey()
	ciphertext, err := base64.StdEncoding.DecodeString(base64Text)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("security: ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", errors.New("security: decryption failed")
	}

	return string(plaintext), nil
}

// Redact masks sensitive keys in JSON content. Falls back to original string if not valid JSON.
func Redact(input string) string {
	if input == "" {
		return ""
	}

	sensitiveKeys := []string{"token", "password", "secret", "api_key", "credentials", "client_secret", "authorization", "oauth", "api_token", "apikey"}

	var data interface{}
	if err := json.Unmarshal([]byte(input), &data); err != nil {
		return input
	}

	redactedData := redactRecursive(data, sensitiveKeys)
	b, _ := json.Marshal(redactedData)
	return string(b)
}

func redactRecursive(data interface{}, sensitiveKeys []string) interface{} {
	switch v := data.(type) {
	case map[string]interface{}:
		newMap := make(map[string]interface{})
		for k, val := range v {
			isSensitive := false
			lowerK := strings.ToLower(k)
			for _, sk := range sensitiveKeys {
				if strings.Contains(lowerK, sk) {
					isSensitive = true
					break
				}
			}
			if isSensitive {
				newMap[k] = "******"
			} else {
				newMap[k] = redactRecursive(val, sensitiveKeys)
			}
		}
		return newMap
	case []interface{}:
		newSlice := make([]interface{}, len(v))
		for i, val := range v {
			newSlice[i] = redactRecursive(val, sensitiveKeys)
		}
		return newSlice
	default:
		return v
	}
}