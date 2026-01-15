//go:build !multitenant
// +build !multitenant

package tenancy

import "github.com/gin-gonic/gin"

const IsMultiTenant = false

// ResolveTenantID always returns the default tenant ID in single-tenant mode
func ResolveTenantID(c *gin.Context) uint {
	return 1
}
