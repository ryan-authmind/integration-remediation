# Stage 1: Build the Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# Stage 2: Build the Backend
FROM golang:1.24-alpine AS backend-builder
WORKDIR /app
# Install build dependencies
RUN apk add --no-cache gcc musl-dev
COPY go.mod go.sum ./
RUN go mod download
COPY . .

# Build arguments
ARG BUILD_TAGS=""

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -tags "${BUILD_TAGS}" -o remediation-server cmd/server/main.go

# Stage 3: Final Production Image
FROM alpine:latest
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /root/

# Create data directory for SQLite
RUN mkdir -p /root/data

# Copy binary from backend-builder
COPY --from=backend-builder /app/remediation-server .

# Copy static assets from frontend-builder (server expects them at ./web/dist)
RUN mkdir -p /root/web/dist
COPY --from=frontend-builder /app/web/dist /root/web/dist

# Expose server port
EXPOSE 8080

# Run the application
CMD ["./remediation-server"]
