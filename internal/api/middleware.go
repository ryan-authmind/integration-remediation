package api

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware enforces API key authentication if ADMIN_API_KEY is set
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := os.Getenv("ADMIN_API_KEY")
		
		// If no key is configured, we allow access but warn (or could block)
		// For this prototype, we'll allow it to avoid breaking dev setup immediately, 
		// but in production this should block.
		if apiKey == "" {
			c.Next()
			return
		}

		// Check Authorization Header (Bearer)
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			token := strings.TrimPrefix(authHeader, "Bearer ")
			if token == apiKey {
				c.Next()
				return
			}
		}

		// Check X-API-Key Header
		if c.GetHeader("X-API-Key") == apiKey {
			c.Next()
			return
		}

		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
	}
}
