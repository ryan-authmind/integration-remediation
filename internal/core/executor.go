package core

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"remediation-engine/internal/database"
	"remediation-engine/internal/integrations"
    "remediation-engine/internal/security"
	"strconv"
	"strings"
	"sync"
	"text/template"
	"time"

	"golang.org/x/time/rate"
	"github.com/masterzen/winrm"
	"gorm.io/gorm"
)

var (
	limiters   = make(map[uint]*rate.Limiter)
	limitersMu sync.Mutex
)

// Executor interface for mocking
type Executor interface {
	Execute(integration database.Integration, definition database.ActionDefinition, contextData map[string]interface{}) ([]byte, int, error)
}

// NewExecutorFunc is a factory function that can be swapped for testing
var NewExecutorFunc = func() Executor {
	return NewActionExecutor()
}

type ActionExecutor struct {
	Client    *http.Client
	DebugMode bool
}

func NewActionExecutor() *ActionExecutor {
	return &ActionExecutor{
		Client:    &http.Client{Timeout: 15 * time.Second},
		DebugMode: os.Getenv("DEBUG") == "true",
	}
}

// Execute performs a generic action (REST or WINRM) based on a definition and context data
func (e *ActionExecutor) Execute(integration database.Integration, definition database.ActionDefinition, contextData map[string]interface{}) ([]byte, int, error) {
	if !integration.IsAvailable {
		return nil, 0, fmt.Errorf("integration %s is currently unavailable (circuit breaker tripped)", integration.Name)
	}

	// 0. Handle Rate Limiting
	if integration.RateLimit > 0 {
		limiter := e.getLimiter(integration.ID, integration.RateLimit)
		if e.DebugMode {
			log.Printf("[Executor] Throttling enabled for %s (%.1f req/sec).", integration.Name, integration.RateLimit)
		}

		ctx := context.Background() // Default context
		if val, ok := contextData["_ctx"].(context.Context); ok {
			ctx = val
		}

		if err := limiter.Wait(ctx); err != nil {
			return nil, 0, fmt.Errorf("rate limit wait failed: %v", err)
		}
	}

	maxRetries := definition.RetryCount
	if maxRetries <= 0 {
		maxRetries = 3 // Default retries
	}

	var lastErr error
	var resp []byte
	var code int

	for i := 0; i <= maxRetries; i++ {
		if i > 0 {
			// Exponential backoff: 1s, 2s, 4s...
			backoff := time.Duration(1<<uint(i-1)) * time.Second
			if e.DebugMode {
				log.Printf("[Executor] Retrying action %s (attempt %d/%d) after %v...", definition.Name, i, maxRetries, backoff)
			}
			time.Sleep(backoff)
		}

		if strings.ToUpper(integration.Type) == "WINRM" {
			resp, lastErr = e.executeWinRM(integration, definition, contextData)
			code = 0 // WinRM doesn't have HTTP codes
		} else if strings.ToUpper(integration.Type) == "SSF" {
			resp, code, lastErr = e.executeSSF(integration, definition, contextData)
		} else {
			resp, code, lastErr = e.executeREST(integration, definition, contextData)
		}

		if lastErr == nil {
			// Success: Reset circuit breaker
			e.handleCircuitSuccess(integration)
			return resp, code, nil
		}

		// Fail fast on Auth errors
		if code == 401 || code == 403 {
			if e.DebugMode {
				log.Printf("[Executor] Aborting retries for %s due to HTTP %d (Auth Error)", definition.Name, code)
			}
			break
		}
	}

	// All retries failed: Increment circuit breaker
	e.handleCircuitFailure(integration)
	return resp, code, fmt.Errorf("all %d attempts failed. Last error: %v", maxRetries+1, lastErr)
}

func (e *ActionExecutor) getLimiter(id uint, rateLimit float64) *rate.Limiter {
	limitersMu.Lock()
	defer limitersMu.Unlock()

	if l, ok := limiters[id]; ok {
		// Update limit if it changed in DB
		if float64(l.Limit()) != rateLimit {
			l.SetLimit(rate.Limit(rateLimit))
		}
		return l
	}

	// Create new limiter: rateLimit req/sec, burst size of 1
	l := rate.NewLimiter(rate.Limit(rateLimit), 1)
	limiters[id] = l
	return l
}

func (e *ActionExecutor) handleCircuitFailure(integration database.Integration) {
	database.DB.Model(&integration).UpdateColumn("consecutive_failures", gorm.Expr("consecutive_failures + 1"))
	
	// Reload to check count (or we can do it in one query if preferred)
	var updated database.Integration
	database.DB.First(&updated, integration.ID)
	
	if updated.ConsecutiveFailures >= 5 {
		log.Printf("[CircuitBreaker] TRIP! Integration %s disabled after 5 failures.", integration.Name)
		database.DB.Model(&updated).Update("is_available", false)
	}
}

func (e *ActionExecutor) handleCircuitSuccess(integration database.Integration) {
	if integration.ConsecutiveFailures > 0 || !integration.IsAvailable {
		database.DB.Model(&integration).Updates(map[string]interface{}{
			"consecutive_failures": 0,
			"is_available":         true,
		})
	}
}

func (e *ActionExecutor) executeREST(integration database.Integration, definition database.ActionDefinition, contextData map[string]interface{}) ([]byte, int, error) {
	// 1. Resolve URL Path
	path, err := e.renderTemplate(definition.PathTemplate, contextData)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to render path: %v", err)
	}
	fullURL := integration.BaseURL + path

	// 2. Resolve Body
	body, err := e.renderTemplate(definition.BodyTemplate, contextData)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to render body: %v", err)
	}
	if e.DebugMode {
		log.Printf("[Executor] Request Payload (%s %s):\n%s", definition.Method, fullURL, security.Redact(body))
	}

	// 3. Create Request
	req, err := http.NewRequest(definition.Method, fullURL, bytes.NewBuffer([]byte(body)))
	if err != nil {
		return nil, 0, err
	}

	// 4. Set Content Type
	req.Header.Set("Content-Type", "application/json")

	// 5. Handle Authentication
	if err := e.applyAuth(req, integration); err != nil {
		return nil, 0, err
	}

	// 6. Execute
	resp, err := e.Client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return respBody, resp.StatusCode, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	return respBody, resp.StatusCode, nil
}

func (e *ActionExecutor) executeWinRM(integration database.Integration, definition database.ActionDefinition, contextData map[string]interface{}) ([]byte, error) {
    // 1. Resolve PowerShell Script (BodyTemplate serves as the Script Template)
    script, err := e.renderTemplate(definition.BodyTemplate, contextData)
    if err != nil {
        return nil, fmt.Errorf("failed to render ps script: %v", err)
    }

    // 2. Parse Credentials
    var creds map[string]string
    json.Unmarshal([]byte(integration.Credentials), &creds)

    // Parse Port from URL or default
    port := 5985
    host := integration.BaseURL // In WinRM mode, BaseURL is just the host
    if parts := strings.Split(host, ":"); len(parts) > 1 {
        host = parts[0]
        p, _ := strconv.Atoi(parts[1])
        port = p
    }

    // 3. Create WinRM Endpoint
    endpoint := winrm.NewEndpoint(host, port, false, false, nil, nil, nil, 0)
    
    client, err := winrm.NewClient(endpoint, creds["username"], creds["password"])
    if err != nil {
        return nil, err
    }

    // 4. Run PowerShell
    var stdout, stderr bytes.Buffer
    _, err = client.Run(winrm.Powershell(script), &stdout, &stderr)
    
    if err != nil {
        return nil, fmt.Errorf("winrm execution failed: %v, stderr: %s", err, stderr.String())
    }

    return stdout.Bytes(), nil
}

func (e *ActionExecutor) executeSSF(integration database.Integration, definition database.ActionDefinition, contextData map[string]interface{}) ([]byte, int, error) {
	// 1. Resolve Payload (BodyTemplate serves as the SSF Payload Template)
	payloadJSON, err := e.renderTemplate(definition.BodyTemplate, contextData)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to render ssf payload: %v", err)
	}

	var payload integrations.SSFPayload
	if err := json.Unmarshal([]byte(payloadJSON), &payload); err != nil {
		return nil, 0, fmt.Errorf("failed to unmarshal ssf payload: %v", err)
	}

	// 2. Parse Credentials for Private Key
	var creds map[string]string
	if err := json.Unmarshal([]byte(integration.Credentials), &creds); err != nil {
		return nil, 0, fmt.Errorf("failed to parse integration credentials: %v", err)
	}

	// 3. Sign Token (SET)
	// Issuer defaults to Tenant Name if not specified in creds
	issuer := creds["issuer"]
	if issuer == "" {
		issuer = integration.Name
	}

	client := integrations.SSFClient{Issuer: issuer}
	
	// Key ID (kid) is optional but recommended
	signedToken, err := client.SignToken(payload, creds["private_key"], creds["key_id"])
	if err != nil {
		return nil, 0, fmt.Errorf("signing failed: %v", err)
	}

	if e.DebugMode {
		log.Printf("[Executor] Generated SET for %s: %s", integration.Name, signedToken)
	}

	// 4. Send Request
	// Note: RFC 8417/8935 uses Content-Type: application/secevent+jwt
	// The body is just the JWT string, OR a JSON object containing it.
	// CAEP/RISC often use Push Delivery (RFC 8935):
	// POST /endpoint HTTP/1.1
	// Content-Type: application/secevent+jwt
	// Accept: application/json
	//
	// [SET JWT]
	
	fullURL := integration.BaseURL
	// Allow path template to append to base url if needed (e.g. specific stream ID)
	if definition.PathTemplate != "" {
		path, err := e.renderTemplate(definition.PathTemplate, contextData)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to render path: %v", err)
		}
		fullURL += path
	}

	req, err := http.NewRequest(definition.Method, fullURL, bytes.NewBuffer([]byte(signedToken)))
	if err != nil {
		return nil, 0, err
	}

	req.Header.Set("Content-Type", "application/secevent+jwt")
	req.Header.Set("Accept", "application/json")

	// Apply Transport Authentication (e.g. Bearer/OAuth2 for the HTTP connection itself)
	// This uses the EXISTING applyAuth method, so we can support standard Auth types for the transport.
	if err := e.applyAuth(req, integration); err != nil {
		return nil, 0, err
	}

	resp, err := e.Client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return respBody, resp.StatusCode, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	return respBody, resp.StatusCode, nil
}

func (e *ActionExecutor) renderTemplate(tplStr string, data interface{}) (string, error) {
	tmpl, err := template.New("action").Funcs(template.FuncMap{
		"default": func(defaultValue string, value interface{}) string {
			if value == nil {
				return defaultValue
			}
			s := fmt.Sprintf("%v", value)
			if s == "" || s == "<nil>" {
				return defaultValue
			}
			return s
		},
		"jsonescape": func(value interface{}) string {
			if value == nil {
				return ""
			}
			b, err := json.Marshal(fmt.Sprintf("%v", value))
			if err != nil {
				return ""
			}
			// json.Marshal adds surrounding quotes, strip them
			s := string(b)
			if len(s) >= 2 {
				return s[1 : len(s)-1]
			}
			return s
		},
		"marshal": func(v interface{}) string {
			a, _ := json.Marshal(v)
			return string(a)
		},
		"truncate": func(length int, value interface{}) string {
			s := fmt.Sprintf("%v", value)
			if len(s) > length {
				if length > 3 {
					return s[:length-3] + "..."
				}
				return s[:length]
			}
			return s
		},
		"ssf_event_type": func(issueType interface{}) string {
			it := fmt.Sprintf("%v", issueType)
			riscPrefix := "https://schemas.openid.net/secevent/risc/event-type/"
			caepPrefix := "https://schemas.openid.net/secevent/caep/event-type/"

			switch strings.ToLower(it) {
			// Account Compromised (RISC)
			case "compromised user", "compromised password", "suspected ad brute-force attack", 
			     "suspected identity brute-force attack", "suspected ad golden ticket attack", 
				 "suspected ad pass-the-ticket attack", "suspected directory/idp bot attack":
				return riscPrefix + "account-compromised"

			// Credential Change Required (RISC / CAEP) - RISC is more common for this
			case "weak password", "password hash length", "password salt", 
			     "md4 related issues", "md5 related issues", "sha-1 related issues":
				return riscPrefix + "credential-change-required"

			// Account Disabled (RISC)
			case "shadow access", "shadow identity systems", "unused identities":
				return riscPrefix + "account-disabled"

			// Assurance Level Change (CAEP) - e.g. MFA missing
			case "lack of mfa", "assets with no mfa configured":
				return caepPrefix + "assurance-level-change"

			// Device Compliance Change (CAEP)
			case "exposed assets", "shadow assets", "repeated ad login attempts from invalid device":
				return caepPrefix + "device-compliance-change"

			// Session Revoked (CAEP) - Default for suspicious activities
			case "suspicious inbound access", "suspicious outbound access", "impossible travel", 
			     "unusual user access", "unauthorized identity access", "access from unauthorized country",
				 "access to unauthorized country", "access using public vpn", "access using anonymous ip",
				 "suspected access token sharing":
				return caepPrefix + "session-revoked"
			
			// Default fallback
			default:
				return caepPrefix + "session-revoked"
			}
		},
	}).Parse(tplStr)
	if err != nil {
		return "", err
	}
	var out bytes.Buffer
	if err := tmpl.Execute(&out, data); err != nil {
		return "", err
	}
	return out.String(), nil
}

func (e *ActionExecutor) applyAuth(req *http.Request, integration database.Integration) error {
	var creds map[string]string
	json.Unmarshal([]byte(integration.Credentials), &creds)

	switch integration.AuthType {
	case "basic":
		req.SetBasicAuth(creds["username"], creds["password"])
	case "bearer":
		req.Header.Set("Authorization", "Bearer "+creds["token"])
	case "apikey":
		headerName := creds["header_name"]
		if headerName == "" {
			headerName = "X-API-Key"
		}
		req.Header.Set(headerName, creds["api_key"])
	case "oauth2":
		token := integration.OAuthToken
		// Check if expired (with 1-min buffer)
		if token == "" || integration.OAuthExpiresAt == nil || time.Now().Add(1*time.Minute).After(*integration.OAuthExpiresAt) {
			var err error
			token, err = e.refreshOAuth2Token(&integration, creds)
			if err != nil {
				return fmt.Errorf("oauth2 refresh failed: %v", err)
			}
		}
		req.Header.Set("Authorization", "Bearer "+token)
	}
	return nil
}

func (e *ActionExecutor) refreshOAuth2Token(integ *database.Integration, creds map[string]string) (string, error) {
	if e.DebugMode {
		log.Printf("[Executor] Refreshing OAuth2 token for %s...", integ.Name)
	}
	
	form := url.Values{}
	form.Add("grant_type", "client_credentials")
	form.Add("client_id", creds["client_id"])
	form.Add("client_secret", creds["client_secret"])

	resp, err := e.Client.PostForm(integ.TokenEndpoint, form)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("auth server returned %d: %s", resp.StatusCode, string(body))
	}

	var data struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", err
	}

	// Update Cache in Memory and DB
	expiresAt := time.Now().Add(time.Duration(data.ExpiresIn) * time.Second)
	integ.OAuthToken = data.AccessToken
	integ.OAuthExpiresAt = &expiresAt

	database.DB.Model(integ).Updates(map[string]interface{}{
		"o_auth_token":      data.AccessToken,
		"o_auth_expires_at": expiresAt,
	})

	return data.AccessToken, nil
}
