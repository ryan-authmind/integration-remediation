//go:build multitenant
// +build multitenant

package tenancy

import (
	"strconv"
	"github.com/gin-gonic/gin"
)

const IsMultiTenant = true

// ResolveTenantID extracts the tenant ID from a header or session in multi-tenant mode
func ResolveTenantID(c *gin.Context) uint {
	// Attempt to get from header (e.g., set by a proxy or middleware)
	tID := c.GetHeader("X-Tenant-ID")
	if id, err := strconv.Atoi(tID); err == nil {
		return uint(id)
	}
    
    // Fallback or potentially return 0 to trigger an error in the handler
	return 1
}
