# Integration Setup Guide

This document details the configuration requirements and permissions needed for third-party integrations.

## 🟢 ServiceNow

To enable the automated creation of incidents in ServiceNow, ensure the following configuration is met:

### Authentication
*   **Method:** Basic Auth or OAuth2.
*   **Base URL:** `https://<your-instance>.service-now.com`

### Required Roles
The user or service account assigned to the integration **must** have the following roles:

| Role | Purpose |
| :--- | :--- |
| `itil` | General access to create and manage incidents. |
| `sn_incident_write` | **Required** to populate and modify the `description` field in incidents. Without this role, the detailed remediation steps and issue metadata will not be visible in the ticket. |

---

## 🔵 Slack

### Setup
1.  Create a **Slack App** in your workspace.
2.  Enable **Incoming Webhooks**.
3.  Install the app to your workspace and select a default channel.
4.  Copy the **Webhook URL** and paste it into the `Base URL` field of the Slack integration in the Remediation Engine.

### Variables Supported
Slack templates support the full range of AuthMind variables and Markdown (MRKDWN) formatting.

---

## 🔴 Okta

### Permissions
The API token used must have permissions to:
*   `okta.users.manage` (for suspending users).
*   `okta.sessions.manage` (for revoking sessions).
