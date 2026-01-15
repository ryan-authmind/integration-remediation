# Remediation Engine Makefile

BINARY_NAME=remediation-server
GO_CMD=/usr/local/go/bin/go
NODE_CMD=npm
TENANT_DIR=tenant

# Build Tags
BUILD_TAGS=
ifeq ($(MULTITENANT),1)
	BUILD_TAGS=-tags multitenant
endif

.PHONY: all build-frontend build-server clean run test test-coverage build-tenant dist

all: test build-frontend build-server

# Run Go Unit Tests
test:
	@echo "Running Tests..."
	$(GO_CMD) test $(BUILD_TAGS) ./...

# Run tests with coverage report
test-coverage:
	@echo "Running Tests with Coverage..."
	$(GO_CMD) test $(BUILD_TAGS) -coverprofile=coverage.out ./...
	$(GO_CMD) tool cover -func=coverage.out

# Build the React Frontend
build-frontend:
	@echo "Building Frontend..."
	cd web && $(NODE_CMD) install && $(NODE_CMD) run build

# Build the Go Backend (depends on tests passing)
build-server: test
	@echo "Building Server..."
	$(GO_CMD) build $(BUILD_TAGS) -o $(BINARY_NAME) cmd/server/main.go

# Build Self-Contained Tenant Package
build-tenant: build-frontend
	@echo "Building Self-Contained Tenant Build..."
	rm -rf $(TENANT_DIR)
	mkdir -p $(TENANT_DIR)/data
	mkdir -p $(TENANT_DIR)/data/seeds
	$(GO_CMD) build $(BUILD_TAGS) -o $(TENANT_DIR)/$(BINARY_NAME) cmd/server/main.go
	cp -r web/dist $(TENANT_DIR)/dist
	cp -r data/seeds/*.json $(TENANT_DIR)/data/seeds/
	@echo "Build complete in $(TENANT_DIR)/"

# Alias for build-tenant
dist: build-tenant

# Run the full application
run: all
	@echo "Launching Remediation Engine..."
	./$(BINARY_NAME)

# Clean build artifacts
clean:
	@echo "Cleaning up..."
	rm -f $(BINARY_NAME)
	rm -rf web/dist
	rm -rf data/remediation.db
	rm -rf $(TENANT_DIR)
