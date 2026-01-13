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

## 💾 Database Schema (Migration from config.json)

We have moved away from `config.json` to a Relational Model:

1.  **Integrations Table**: Stores credentials (API Keys, URLs).
2.  **Workflows Table**: Replaces "Issue Types". Contains metadata about the remediation.
3.  **WorkflowSteps Table**: Ordered list of actions to execute.
4.  **Jobs Table**: History of executions (replacing log files).

## 📅 Roadmap

- [x] Initial Project Scaffold
- [x] Database Models & Auto-Migration
- [ ] Port `actions/` logic from Python to Go
- [ ] Implement `Polling` worker in Go
- [ ] Build React Flow Interface
