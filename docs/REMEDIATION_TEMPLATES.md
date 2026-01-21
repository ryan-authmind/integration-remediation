# Remediation Templates & Recommendations

The Remediation Engine includes a built-in knowledge base of security remediation steps tailored to AuthMind issue types. This data can be dynamically injected into your workflows (e.g., Slack notifications, ServiceNow tickets, Email alerts) to provide actionable guidance to security teams or end-users.

## 📚 Overview

When a workflow is triggered by an AuthMind issue, the engine automatically searches for a matching **Remediation Recommendation** based on the `IssueType`. If found, the recommendation details (Title, Description, Steps, URL) are injected into the workflow context.

## 🛠 Using Remediation Variables in Templates

You can use the following variables in any **Action Template** (Body Template) or **Message Template** (Title, Message, Footer):

| Variable | Description | Example Output |
| :--- | :--- | :--- |
| `{{.RemediationTitle}}` | The title of the remediation topic. | `Remediation for Compromised User` |
| `{{.RemediationDescription}}` | A high-level explanation of the risk. | `A user account shows signs of compromise...` |
| `{{.RemediationSteps}}` | Detailed, markdown-formatted steps to fix the issue. | `1. Reset password...` |
| `{{.RemediationURL}}` | Link to the official AuthMind documentation. | `https://docs.authmind.com/...` |

### Example: Slack Notification Template

You can create a customized Slack message that includes the specific steps to resolve the alert:

```json
{
  "text": ":rotating_light: *Security Alert: {{.IssueType}}*",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*User:* {{.UserEmail}}\n*Risk Level:* {{.Risk}}"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Recommended Action:*
{{.RemediationSteps}}"
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "<{{.RemediationURL}}|View Full Documentation>"
        }
      ]
    }
  ]
}
```

## 🔄 Automatic Matching Logic

The engine attempts to match remediation data using the following priority:

1.  **Exact Match:** Matches the AuthMind `IssueType` (e.g., "Compromised User") with the `issue_type` in the database.
2.  **Workflow Name Fallback:** If the exact issue type isn't found, it tries to match the **Workflow Name**. This allows you to create custom workflows (e.g., "Handle VIP Alerts") that still pull standard remediation data by naming the workflow appropriately or relying on the underlying issue type.

## 📝 Managing Remediation Data

Remediation data is stored in the `remediation_recommendations` table.
*   **Seeding:** Default recommendations are loaded from `data/seeds/remediations.json` during startup.
*   **Customization:** You can modify the seed file or directly update the database if you wish to provide organization-specific runbooks.
