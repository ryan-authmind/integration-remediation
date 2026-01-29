package api

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// AuthMiddleware enforces authentication via JWT or API key
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		adminKey := os.Getenv("ADMIN_API_KEY")
		authHeader := c.GetHeader("Authorization")

		// 1. Try JWT Bearer Token
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			
			// If it matches the admin key, it's a legacy/service call
			if adminKey != "" && tokenString == adminKey {
				c.Set("user_id", uint(0)) // System/Admin user
				c.Set("user_role", "admin")
				c.Next()
				return
			}

			// Otherwise, try to parse as JWT
			token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return GetJWTSecret(), nil
			})

			if err == nil && token.Valid {
				if claims, ok := token.Claims.(*Claims); ok {
					c.Set("user_id", claims.UserID)
					c.Set("user_role", claims.Role)
					c.Next()
					return
				}
			}
		}

		// 2. Try X-API-Key Header (Legacy)
		if adminKey != "" && c.GetHeader("X-API-Key") == adminKey {
			c.Set("user_id", uint(0))
			c.Set("user_role", "admin")
			c.Next()
			return
		}

		// 3. Fallback: If no auth is required yet (dev mode)
		if adminKey == "" {
			c.Next()
			return
		}

		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
	}
}

// RBACMiddleware checks if the authenticated user has one of the required roles
func RBACMiddleware(requiredRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "access denied: no role assigned"})
			return
		}

		role := userRole.(string)

		// Admin always has access
		if role == "admin" {
			c.Next()
			return
		}

		// Check if user's role is in the allowed list
		for _, r := range requiredRoles {
			if role == r {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "access denied: insufficient permissions"})
	}
}
