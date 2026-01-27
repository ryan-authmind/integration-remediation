package integrations

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

func TestSignToken(t *testing.T) {
	// Generate a temporary key for testing
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	assert.NoError(t, err)

	privDER := x509.MarshalPKCS1PrivateKey(privateKey)
	privBlock := pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: privDER,
	}
	privPEM := string(pem.EncodeToMemory(&privBlock))

	client := SSFClient{Issuer: "test-issuer"}
	payload := SSFPayload{
		Subject: map[string]interface{}{"user": "test@example.com"},
		Events: map[string]interface{}{
			"http://schemas.openid.net/secevent/caep/event-type/session-revoked": map[string]string{
				"reason": "test",
			},
		},
	}

	tokenString, err := client.SignToken(payload, privPEM, "key-1")
	assert.NoError(t, err)
	assert.NotEmpty(t, tokenString)

	// Verify the token
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return &privateKey.PublicKey, nil
	})

	assert.NoError(t, err)
	assert.True(t, token.Valid)

	claims, ok := token.Claims.(jwt.MapClaims)
	assert.True(t, ok)
	assert.Equal(t, "test-issuer", claims["iss"])
	
	events := claims["events"].(map[string]interface{})
	assert.Contains(t, events, "http://schemas.openid.net/secevent/caep/event-type/session-revoked")
}
