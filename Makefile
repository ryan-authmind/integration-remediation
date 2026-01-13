# Remediation Engine Makefile

BINARY_NAME=remediation-server
GO_CMD=/usr/local/go/bin/go
NODE_CMD=npm

.PHONY: all build-frontend build-server clean run test test-coverage

all: test build-frontend build-server

# Run Go Unit Tests
test:
	@echo "Running Tests..."
	$(GO_CMD) test ./...

# Run tests with coverage report
test-coverage:
	@echo "Running Tests with Coverage..."
	$(GO_CMD) test -coverprofile=coverage.out ./...
	$(GO_CMD) tool cover -func=coverage.out

# Build the React Frontend
build-frontend:
	@echo "Building Frontend..."
	cd web && $(NODE_CMD) install && $(NODE_CMD) run build

# Build the Go Backend (depends on tests passing)
build-server: test
	@echo "Building Server..."
	$(GO_CMD) build -o $(BINARY_NAME) cmd/server/main.go

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
