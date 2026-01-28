package main

import (
	"log"
	"os"
	"path/filepath"
	"strings"
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

	// Public Auth Routes
	apiRoutes.POST("/auth/login", api.Login)

	apiRoutes.Use(api.AuthMiddleware())

	{
		apiRoutes.GET("/auth/me", api.GetCurrentUser)
		apiRoutes.GET("/audit/logs", api.RBACMiddleware("admin"), api.GetAuditLogs)
		
		// Integrations
		apiRoutes.GET("/integrations", api.GetIntegrations)
		apiRoutes.POST("/integrations", api.RBACMiddleware("integrator"), api.CreateIntegration)
		apiRoutes.PUT("/integrations", api.RBACMiddleware("integrator"), api.UpdateIntegration)
		apiRoutes.PUT("/integrations/:id/reset", api.RBACMiddleware("integrator"), api.ResetIntegrationCircuitBreaker)
		
		// Action Templates
		apiRoutes.GET("/actions", api.GetActionDefinitions)
		apiRoutes.POST("/actions", api.RBACMiddleware("action_builder"), api.CreateActionDefinition)
		apiRoutes.PUT("/actions", api.RBACMiddleware("action_builder"), api.UpdateActionDefinition)
		apiRoutes.POST("/import", api.RBACMiddleware("action_builder", "integrator"), api.ImportConfiguration)
		
		// Workflows
		apiRoutes.GET("/workflows", api.GetWorkflows)
		apiRoutes.POST("/workflows", api.RBACMiddleware("workflow_editor"), api.CreateWorkflow)
		apiRoutes.PUT("/workflows", api.RBACMiddleware("workflow_editor"), api.UpdateWorkflow)
		apiRoutes.DELETE("/workflows/:id", api.RBACMiddleware("workflow_editor"), api.DeleteWorkflow)
		
		// Jobs & Operations
		apiRoutes.GET("/jobs", api.GetJobs)
		apiRoutes.POST("/jobs/:id/rerun", api.RBACMiddleware("workflow_editor", "admin"), api.RerunJob)
		apiRoutes.GET("/jobs/:id/logs", api.GetJobLogs)
		
		apiRoutes.GET("/stats", api.GetDashboardStats)
		apiRoutes.GET("/settings", api.GetSettings)
		apiRoutes.PUT("/settings", api.RBACMiddleware("admin"), api.UpdateSetting)

		// Admin Routes (Global context)
		adminRoutes := apiRoutes.Group("/admin")
		adminRoutes.Use(api.RBACMiddleware("admin"))
		{
			adminRoutes.GET("/tenants", api.GetTenants)
			adminRoutes.POST("/tenants", api.CreateTenant)
			adminRoutes.PUT("/tenants/:id", api.UpdateTenant)
			adminRoutes.DELETE("/tenants/:id", api.DeleteTenant)
			adminRoutes.POST("/tenants/:id/bootstrap", api.BootstrapTenant)
			adminRoutes.GET("/stats", api.GetAggregateStats)
		}
	}

	distPath, _ := filepath.Abs("./dist")
	if _, err := os.Stat(filepath.Join(distPath, "index.html")); err != nil {
		distPath, _ = filepath.Abs("./web/dist")
	}
	log.Printf("[Server] Resolved frontend assets path: %s", distPath)

	// 1. Serve specific static files and directories
	r.Static("/assets", filepath.Join(distPath, "assets"))
	r.Static("/vendors", filepath.Join(distPath, "vendors"))
	r.StaticFile("/favicon.ico", filepath.Join(distPath, "favicon.ico"))
	r.StaticFile("/favicon.png", filepath.Join(distPath, "favicon.png"))
	r.StaticFile("/logo-darkmode.png", filepath.Join(distPath, "logo-darkmode.png"))
	r.StaticFile("/authmind-logo-light.png", filepath.Join(distPath, "authmind-logo-light.png"))
	r.StaticFile("/", filepath.Join(distPath, "index.html"))

	// 2. Main SPA fallback for all other routes
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// API routes should never serve index.html
		if strings.HasPrefix(path, "/api") {
			c.JSON(http.StatusNotFound, gin.H{"error": "API route not found"})
			return
		}

		// For everything else, serve index.html to allow React Router to take over
		c.File(filepath.Join(distPath, "index.html"))
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
