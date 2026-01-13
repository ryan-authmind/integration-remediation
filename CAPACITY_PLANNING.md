# Capacity Planning & Data Retention Forecast

This document outlines the storage requirements and data management policies for the Integration & Remediation Engine.

## 📊 Storage Estimates

Based on average message sizes and current data structure, we estimate the following storage requirements for SQLite:

| Event Volume | Estimated Disk Space | Components |
| :--- | :--- | :--- |
| **1,000 Events** | ~4.5 MB | 1 Job, ~3 Logs, Trigger Context JSON |
| **10,000 Events** | ~45 MB | Standard active deployment |
| **100,000 Events** | ~450 MB | High-volume deployment |
| **1,000,000 Events** | ~4.5 GB | Enterprise-scale deployment |

*Note: Estimates include SQLite WAL (Write-Ahead Logging) overhead and indexing.*

## ⚙️ Data Retention Policy

To ensure long-term stability and prevent unbounded disk growth, the system enforces an automated **Data Retention Policy**.

### Policy Details
*   **Default Retention:** 90 Days.
*   **Mechanism:** A background worker runs every 24 hours to delete `Jobs` and `JobLogs` older than the configured threshold.
*   **Optimization:** After cleanup, the system executes a `VACUUM` command to defragment the database file and reclaim unused disk space.

### UI Configuration
The retention period can be configured directly in the **Dashboard** under the **Data Retention** section. 

| Setting | Impact |
| :--- | :--- |
| **30 Days** | Minimum storage footprint, best for high-frequency environments. |
| **90 Days** | Recommended balance between audit history and performance. |
| **1 Year** | High retention for compliance requirements; requires more disk space. |

## 🛠 Maintenance Recommendations

1.  **Disk Monitoring:** Ensure the `data/` directory has at least 5GB of free space for typical usage.
2.  **Backups:** Since the application uses SQLite, a simple file-level copy of `remediation.db` is sufficient for backups. Perform backups during low-activity periods.
3.  **IO Performance:** For high-volume environments (100k+ events), SSD storage is highly recommended to handle concurrent logging and polling.
