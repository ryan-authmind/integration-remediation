package api

import (
	"net/http"
	"os"
	"remediation-engine/internal/database"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

func init() {
	if len(jwtSecret) == 0 {
		log.Fatal("CRITICAL: JWT_SECRET environment variable is not set. Authentication cannot be initialized.")
	}
}

type Claims struct {
	UserID uint   `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// Login handles local and placeholder authentication
func Login(c *gin.Context) {
	var input struct {
		Email    string `json:"email"`
		Password string `json:"password"` // Placeholder
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	// 1. Find or Create User (Placeholder Logic)
	var user database.User
	if err := database.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		user = database.User{
			Email:    input.Email,
			Name:     "Initial User",
			Role:     "admin",
			Provider: "local",
		}
		database.DB.Create(&user)
	}

	// 2. Generate JWT
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

    // Log the login event
    LogAudit(c, user.ID, 0, "LOGIN", "USER", string(rune(user.ID)), "User logged in via local provider")

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user":  user,
	})
}

// GetCurrentUser returns the profile of the authenticated user
func GetCurrentUser(c *gin.Context) {
    userID, _ := c.Get("user_id")
    var user database.User
    if err := database.DB.First(&user, userID).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
        return
    }
    c.JSON(http.StatusOK, user)
}
