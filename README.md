# Remediation Engine (Migration Target)

This project represents the next generation of the remediation tool, moving from a Python script to an always-on **Go** service with a **SQLite** backend and **React** interface.

## 🏗 Architecture

*   **Backend:** Go (Golang) 1.21+
*   **Database:** SQLite (Embedded, WAL mode enabled)
*   **API:** REST (Gin Framework)
*   **Frontend:** React + Material UI (Vite)

## 📂 Project Structure

```text
remediation-engine/
├── cmd/server/         # Entry point (main.go)
├── internal/
│   ├── database/       # Schema & Migrations (GORM)
│   ├── core/           # Workflow Engine Logic
│   └── api/            # API Handlers
├── web/                # React Frontend (Workflow Builder)
└── data/               # SQLite DB storage (ignored in git)
```

## 🚀 Getting Started

### Prerequisites
*   Go 1.21 or higher
*   Node.js 18+ (for frontend)

### 1. Start the Backend
```bash
cd remediation-engine
go mod tidy
go run cmd/server/main.go
```
*The server will start on http://localhost:8080. It will automatically create `data/remediation.db`.*

### 2. Start the Frontend (UI)
```bash
cd web
npm install
npm run dev
```
*The UI will run on http://localhost:5173.*

## 🐳 Deployment (Docker)

The application can be built and run as a single containerized unit:

```bash
docker build -t remediation-engine .
docker run -p 8080:8080 -v $(pwd)/data:/root/data remediation-engine
```

*Note: Persistent storage for the SQLite database is handled via the volume mount to `/root/data`.*

## 📊 Capacity & Maintenance

For detailed information on storage estimates, scaling, and database maintenance, please refer to:
👉 **[CAPACITY_PLANNING.md](./CAPACITY_PLANNING.md)**

### Data Retention Policy
The system includes an automated cleanup worker that:
*   Deletes jobs and logs older than a configurable threshold (Default: **90 days**).
*   Enforces the policy daily and executes a `VACUUM` to optimize disk space.
*   Retention period can be modified in the **System Performance** dashboard.

## 💾 Database Schema (Migration from config.json)

We have moved away from `config.json` to a Relational Model:

1.  **Integrations Table**: Stores credentials (API Keys, URLs).
2.  **Workflows Table**: Replaces "Issue Types". Contains metadata about the remediation.
3.  **WorkflowSteps Table**: Ordered list of actions to execute.
4.  **Jobs Table**: History of executions (replacing log files).

## 📅 Roadmap

- [x] Initial Project Scaffold
- [x] Database Models & Auto-Migration
- [x] Port `actions/` logic from Python to Go (Template-based Actions)
- [x] Implement `Polling` worker in Go (Master Poller Mode)
- [x] Build React Workflow Editor
- [x] Implement OAuth2 & Rate Limiting
- [x] Data Retention & Capacity Planning

