# Security, Authentication & Audit

This document outlines the security architecture of the Integration & Workflow Engine, including authentication mechanisms, Role-Based Access Control (RBAC), and administrative audit logging.

## 🔐 Authentication

The system uses a multi-layered authentication strategy to secure API access and UI management.

### 1. Identity Providers (OIDC)
The application supports **OpenID Connect (OIDC)** for Single Sign-On (SSO). This allows users to authenticate using existing corporate accounts from providers like Google or Microsoft Entra ID.

**Configuration:**
To enable OIDC, set the following environment variables:
```bash
OIDC_ISSUER_URL=https://accounts.google.com # Or your Entra tenant URL
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
REDIRECT_URL=https://your-app-domain.com/api/auth/callback
JWT_SECRET=your-secure-random-string
```

### 2. JWT-Based Sessions
Once authenticated via OIDC or local login, the backend issues a **JSON Web Token (JWT)**.
*   **Storage:** The token is stored in the browser's `localStorage`.
*   **Transmission:** Included in the `Authorization: Bearer <token>` header for all API requests.
*   **Expiry:** Tokens are valid for 24 hours by default.

### 3. Service API Keys (Legacy/Automated)
For automated system-to-system communication, the engine supports static API keys via the `ADMIN_API_KEY` environment variable. These requests are mapped to a system "Admin" user.

---

## 👥 Role-Based Access Control (RBAC)

The system enforces the principle of least privilege through granular roles. Access is controlled at the API level via the `RBACMiddleware`.

| Role | Permissions |
| :--- | :--- |
| **Admin** | Full system access, including tenant management, system settings, and audit logs. |
| **Integrator** | Can create, update, and test Integration connections. |
| **Action Builder** | Can define and modify API Action Templates. |
| **Workflow Editor** | Can design and enable/disable automated remediation workflows. |
| **Viewer** | Read-only access to dashboards, integrations, and workflow configurations. |

### Default Account
During the first initialization, the system automatically seeds a default administrator account:
*   **Email:** `admin@authmind.com`
*   **Role:** `admin`

---

## 📜 Audit Logging

Every state-changing action performed in the UI or via the API is recorded in a tamper-evident audit trail.

### Logged Data
Each audit entry captures:
*   **Timestamp:** Exact date and time of the action.
*   **User:** The identity of the person (or system key) who performed the action.
*   **Action Type:** `CREATE`, `UPDATE`, `DELETE`, `EXECUTE`, or `LOGIN`.
*   **Resource:** The target object (e.g., `WORKFLOW`, `INTEGRATION`).
*   **Details:** A JSON snapshot of the changes or context.
*   **IP Address:** The network origin of the request.

### Viewing Logs
Audit logs are accessible to users with the **Admin** role under the **"Audit History"** section of the administration console.

---

## 🔒 Data Encryption

*   **Credentials:** All integration credentials (API keys, passwords, client secrets) are encrypted at rest in the SQLite database using AES-256 GCM.
*   **Transmission:** All communication should be conducted over HTTPS. The engine supports TLS termination if configured via a reverse proxy (e.g., Nginx) or standard Go `http.ListenAndServeTLS`.
