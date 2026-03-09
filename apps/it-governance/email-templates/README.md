# System Notification Email Templating Architecture

## Overview

This system provides a structured, environment-safe way to generate and send dynamic HTML emails from Power Automate using reusable templates stored in Dataverse.

Email templates are:

- Authored in our code repository (markup copied from the EASI codebase)
- Uploaded to the **System Notification Email Template** table
- Retrieved dynamically via a child flow
- Populated using token replacement
- Sent using Outlook **Send an Email (V2)**

This architecture ensures:

- Separation of markup from flow logic
- Reusable templates across flows
- Environment-safe deployment
- Consistent formatting and branding

# Architecture Summary

```
Power Automate Parent Flow
        ↓
Run a Child Flow → "Compose Email HTML From Template"
        ↓
Template retrieved from Dataverse
        ↓
Tokens replaced in markup
        ↓
Return EmailSubject + EmailBody
        ↓
Send an Email (V2)
```

# Template Storage

Templates are stored in the Dataverse table:

**System Notification Email Template**

Key fields:

- `TemplateKey` (Alternate Key – unique identifier)
- `EmailSubject`
- `EmailBody` (HTML markup)

Templates are:

1. Authored in the repo
2. Reviewed/versioned in code
3. Copied into Dataverse (System Notification Email Template table)
4. Referenced in flows by `TemplateKey`

# TemplateKey Usage

Each template is uniquely identified by:

```
RequesterTemplateKey
```

When calling the child flow, we pass:

- `RequesterTemplateKey`
- `Tokens` (stringified JSON)

The child flow:

1. Retrieves the template by `TemplateKey`
2. Performs token replacement
3. Returns:
   - `emailSubject`
   - `emailBody`

# 🧩 Token Replacement Pattern

Tokens are passed as a JSON array of key/value pairs.

Example:

```json
[
  {
    "key": "RequestName",
    "value": "@{outputs('GetRequest')?['body/new_name']}"
  },
  {
    "key": "Step",
    "value": "@{triggerOutputs()?['body/_new_process_target_step_label']}"
  },
  {
    "key": "Feedback",
    "value": "@{triggerOutputs()?['body/new_requester_feedback']}"
  },
  {
    "key": "RequesterName",
    "value": "@{outputs('GetRequester')?['body/fullname']}"
  },
  {
    "key": "SystemIntakeRequestLink",
    "value": "@{outputs('IntakeRequestLink')}"
  },
  {
    "key": "SystemIntakeAdminLink",
    "value": "@{outputs('ReviewLink')}"
  },
  {
    "key": "ITGovernanceInboxAddress",
    "value": "@{outputs('ITGovernanceInboxAddress')}"
  },
  {
    "key": "AdditionalInfo",
    "value": "@{triggerOutputs()?['body/new_additionalinformation']}"
  }
]
```

The array is stringified before being passed to the child flow:

```powerautomate
string(outputs('tokens'))
```

# 🛠 Child Flow: Compose Email HTML From Template

### Inputs

- `TemplateKey` (string)
- `Tokens` (stringified JSON array)

### Responsibilities

1. Get template row from Dataverse using `TemplateKey`
2. Parse tokens
3. Replace placeholders in:
   - `EmailSubject`
   - `EmailBody`

4. Return:
   - `emailSubject`
   - `emailBody`

# Sending the Email

After the child flow returns:

- `emailSubject`
- `emailBody`

These are passed directly to:

**Send an Email (V2)**

Example:

```
Subject → outputs('Compose_Email_HTML_From_Template')?['emailSubject']
Body    → outputs('Compose_Email_HTML_From_Template')?['emailBody']
```

Recipients are defined separately (environment variable, user lookup, or other logic).

# Design Principles

### Separation of Concerns

- Markup lives in Dataverse
- Logic lives in flows
- Token values live in parent flow context

### Environment Safety

- Templates are deployed via solution
- Email recipients use Environment Variables
- No hardcoded environment-specific URLs

### Maintainability

- Updating email markup does not require editing every flow
- Adding a new template only requires:
  - New row in template table
  - Passing a new TemplateKey

# Adding a New Template

1. Add markup to repo
2. Upload to **System Notification Email Template**
3. Ensure unique `TemplateKey`
4. Call child flow with that key
5. Provide tokens
6. Send returned subject/body

No changes required to the email engine flow.

# Benefits

- Consistent HTML structure
- Reusable templates
- Reduced flow duplication
- Centralized branding updates
- Scalable to new notification types
