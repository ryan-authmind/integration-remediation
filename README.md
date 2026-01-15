# Integration & Workflow Engine (Multi-Tenant)

This project is a high-performance **Integration & Workflow Engine** designed to automate security remediations and identity governance. It has evolved from a simple Python script into a scalable, always-on **Go** service with a **SQLite** backend and a **React** administration console.

## 🏗 Architecture

*   **Backend:** Go (Golang) 1.21+
*   **Database:** SQLite (Embedded, WAL mode enabled for high concurrency)
*   **Execution:** Scalable **Worker Pool** (default 20 workers) for parallel task processing.
*   **API:** REST (Gin Framework)
*   **Frontend:** React + Material UI (Vite)

For a deep dive into the system components and data flow, see:
👉 **[ARCHITECTURE.md](./ARCHITECTURE.md)**

## 💻 System Requirements

### Hardware
*   **CPU:** 1 Core+ (x86_64 or ARM64)
*   **RAM:** 512 MB+ (1 GB recommended)
*   **Storage:** 500 MB+ free space (SSD preferred for SQLite performance)

### Software
*   **Prerequisites:** Go 1.21+, Node.js 18+ (for development)
*   **Deployment:** Docker (optional), Linux/macOS/Windows compatible

## 🏢 Tenancy Modes

The engine supports two distribution modes controlled by build-time flags:

1.  **Single-Tenant (Default):** Designed for on-prem or single-environment deployments. All data is scoped to a single system tenant (ID 1).
2.  **Multi-Tenant:** Designed for SaaS or MSP environments. Data is scoped by `TenantID`. The engine resolves the tenant context from the `X-Tenant-ID` header.

## 🛠 Administration Console

The integrated React dashboard provides full control over the remediation engine:

*   **Dashboard:** Real-time monitoring of job success rates, active workers, and recent remediation events.
*   **Workflow Editor:** A visual builder for creating multi-step remediation sequences with severity-based triggers.
*   **Integration Manager:** Configure and test connections to AuthMind, Slack, ServiceNow, and custom REST APIs.
*   **Action Templates:** Define reusable API payloads with dynamic variable interpolation.
*   **Tenant Management:** (Multi-tenant mode only) Manage customer environments, API keys, and isolated configurations.

## 📂 Project Structure

```text
integration-remediation/
├── cmd/server/         # Entry point (main.go)
├── internal/
│   ├── database/       # Schema & Migrations (GORM)
│   ├── core/           # Workflow Engine (Scheduler & Worker Pool)
│   ├── api/            # API Handlers
│   ├── tenancy/        # Conditional logic for Single vs Multi-tenant mode
│   └── integrations/   # SDKs (AuthMind, ServiceNow, Slack, etc.)
├── web/                # React Frontend (Workflow Builder)
├── tenant/             # Output directory for self-contained builds
└── data/               # SQLite DB storage (ignored in git)
```

## 🚀 Development

### Prerequisites
*   Go 1.21 or higher
*   Node.js 18+ (for frontend)

### 1. Start the Backend
```bash
# Default mode (Single-Tenant)
go run cmd/server/main.go

# Multi-Tenant mode (for local testing)
go run -tags multitenant cmd/server/main.go
```

### 2. Start the Frontend (UI)
```bash
cd web
npm install
npm run dev
```

## 📦 Distribution & Building

The project uses a `Makefile` to generate self-contained, portable distributions. These builds include the Go binary, the frontend assets, and a data directory.

### Build Single-Tenant Distribution
```bash
make dist
```

### Build Multi-Tenant Distribution
```bash
make dist MULTITENANT=1
```

*The output will be located in the `./tenant` directory. You can move this entire folder to any server and run the `./remediation-server` binary.*

## 🐳 Deployment (Docker)

The application can be built and run as a single containerized unit:

```bash
docker build -t integration-workflow-engine .
docker run -p 8080:8080 -v $(pwd)/data:/root/data integration-workflow-engine
```

## 📊 Capacity & Maintenance

For detailed information on storage estimates, scaling, and database maintenance, please refer to:
👉 **[CAPACITY_PLANNING.md](./CAPACITY_PLANNING.md)**

### Data Retention Policy
The system includes an automated cleanup worker that:
*   Deletes jobs and logs older than a configurable threshold (Default: **90 days**).
*   Enforces the policy daily and executes a `VACUUM` to optimize disk space.

## 📅 Roadmap

- [x] Multi-Tenant Database Schema
- [x] Scalable Worker Pool Implementation
- [x] Build Tags for Single/Multi-tenant distributions
- [x] React Workflow Editor with Severity Thresholds
- [x] Port Template-based Actions from Python
- [x] Data Retention & Capacity Planning
- [ ] Authentication Middleware (OIDC/SAML)
- [ ] Advanced RBAC for Multi-tenant isolation