package integrations

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type SSFClient struct {
	Issuer string // The 'iss' claim (likely our own URL or Tenant ID)
}

// SSFPayload defines the structure expected from the Action Template
type SSFPayload struct {
	Subject map[string]interface{} `json:"subject"`
	Events  map[string]interface{} `json:"events"`
}

// SignToken generates a signed JWT (SET) using the provided private key
func (c *SSFClient) SignToken(payload SSFPayload, keyPEM string, keyID string) (string, error) {
	// 1. Parse Private Key
	block, _ := pem.Decode([]byte(keyPEM))
	if block == nil {
		return "", fmt.Errorf("failed to parse private key PEM")
	}

	var privateKey *rsa.PrivateKey
	var err error
	
	if block.Type == "RSA PRIVATE KEY" {
		privateKey, err = x509.ParsePKCS1PrivateKey(block.Bytes)
	} else if block.Type == "PRIVATE KEY" {
		key, err2 := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err2 != nil {
			return "", err2
		}
		var ok bool
		privateKey, ok = key.(*rsa.PrivateKey)
		if !ok {
			return "", fmt.Errorf("not an RSA private key")
		}
	} else {
		return "", fmt.Errorf("unsupported key type: %s", block.Type)
	}
	
	if err != nil {
		return "", err
	}

	// 2. Prepare Claims
	now := time.Now()
	
	// Use MapClaims for full flexibility including 'subject' as an object
	mapClaims := jwt.MapClaims{
		"iss":    c.Issuer,
		"iat":    now.Unix(),
		"jti":    uuid.New().String(),
		"events": payload.Events,
	}

	// Add 'sub' if it's a simple string, or 'subject' if it's a complex object
	// The ActionTemplate provided 'Subject' as a map.
	// RFC 8417: "The 'sub' claim... MAY be present... if the subject is identified by a URI or... StringOrURI."
	// "The 'subject' member... identifies the subject...". This is NOT a top-level JWT claim usually, it's often inside the event or replacing 'sub'.
	// WAIT: RFC 8417 Section 2.2: "The SET... MAY contain a 'sub' claim... OR a 'subject' claim... but NOT BOTH."
	// 'subject' value is a JSON object (the Subject Identifier).
	
	if payload.Subject != nil {
		mapClaims["subject"] = payload.Subject
	}

	// 3. Sign
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, mapClaims)
	
	// Set Headers
	token.Header["typ"] = "secevent+jwt"
	if keyID != "" {
		token.Header["kid"] = keyID
	}

	return token.SignedString(privateKey)
}
