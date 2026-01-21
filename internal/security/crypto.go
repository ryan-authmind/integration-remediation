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

// ... (GetEncryptionKey, Encrypt, Decrypt, decryptRaw remain same)

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
