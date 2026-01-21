package main

import (
	"log"
	"os"
	"remediation-engine/internal/api"
	"remediation-engine/internal/core"
	"remediation-engine/internal/database"
	"remediation-engine/internal/tenancy"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// 1. Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	modeStr := "Single-Tenant"
	if tenancy.IsMultiTenant {
		modeStr = "Multi-Tenant"
	}
	log.Printf("Starting Integration & Remediation Engine (%s Mode)...", modeStr)

	// 2. Initialize Database

	database.InitDB("data/remediation.db")

	// 3. Seed and Sync Data (from filesystem JSON)

	database.SeedDatabase(database.DB, "data/seeds")

	// 4. Start Workflow Engine in background

	engine := core.NewEngine()

	go engine.Start()

	// 5. Setup Web Server

	r := gin.Default()

	// CORS Middleware

	r.Use(func(c *gin.Context) {

		allowedOrigin := os.Getenv("ALLOWED_ORIGIN")

		if allowedOrigin == "" {

			allowedOrigin = "http://localhost:5173" // Default Vite dev port

		}

		origin := c.Request.Header.Get("Origin")

		// Allow if origin matches allowed or if no origin (server-to-server/curl)

		if origin == allowedOrigin || origin == "" {

			c.Writer.Header().Set("Access-Control-Allow-Origin", allowedOrigin)

		}

		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, X-API-Key")

		if c.Request.Method == "OPTIONS" {

			c.AbortWithStatus(204)

			return

		}

		c.Next()

	})

	// API Routes

	apiRoutes := r.Group("/api")

	apiRoutes.Use(api.AuthMiddleware())

	{

		apiRoutes.GET("/integrations", api.GetIntegrations)

		apiRoutes.POST("/integrations", api.CreateIntegration)
		apiRoutes.PUT("/integrations", api.UpdateIntegration)
		apiRoutes.PUT("/integrations/:id/reset", api.ResetIntegrationCircuitBreaker)
		apiRoutes.GET("/actions", api.GetActionDefinitions)
		apiRoutes.POST("/actions", api.CreateActionDefinition)
		apiRoutes.PUT("/actions", api.UpdateActionDefinition)
		apiRoutes.POST("/import", api.ImportConfiguration)
		apiRoutes.GET("/workflows", api.GetWorkflows)
		apiRoutes.POST("/workflows", api.CreateWorkflow)
		apiRoutes.PUT("/workflows", api.UpdateWorkflow)
		apiRoutes.DELETE("/workflows/:id", api.DeleteWorkflow)
		apiRoutes.GET("/jobs", api.GetJobs)
		apiRoutes.POST("/jobs/:id/rerun", api.RerunJob)
		apiRoutes.GET("/jobs/:id/logs", api.GetJobLogs)
		apiRoutes.GET("/stats", api.GetDashboardStats)
		apiRoutes.GET("/settings", api.GetSettings)
		apiRoutes.PUT("/settings", api.UpdateSetting)

		// Admin Routes (Global context)
		adminRoutes := apiRoutes.Group("/admin")
		{
			adminRoutes.GET("/tenants", api.GetTenants)
			adminRoutes.POST("/tenants", api.CreateTenant)
			adminRoutes.PUT("/tenants/:id", api.UpdateTenant)
			adminRoutes.DELETE("/tenants/:id", api.DeleteTenant)
			adminRoutes.POST("/tenants/:id/bootstrap", api.BootstrapTenant)
			adminRoutes.GET("/stats", api.GetAggregateStats)
		}
	}

	// Serve Static Frontend Assets
	// Try local 'dist' first (for self-contained builds), then 'web/dist' (for development)
	distPath := "./dist"
	if _, err := os.Stat(distPath + "/index.html"); err != nil {
		distPath = "./web/dist"
	}

	r.Static("/assets", distPath+"/assets")

	// Fallback for React Router (Single Page App) and root-level static files
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		// Check if the file exists in the dist directory
		fullPath := distPath + path
		if _, err := os.Stat(fullPath); err == nil && path != "/" {
			c.File(fullPath)
			return
		}
		// Otherwise serve index.html for SPA
		c.File(distPath + "/index.html")
	})

	log.Println("Starting Integration & Remediation Engine...")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	if err := r.Run(":" + port); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}
