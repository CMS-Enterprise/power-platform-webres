# Additional Contact Creation Plugin

This folder contains a Dataverse plugin that ensures **requesters are represented as explicit “Additional Contact” records** with a defined role in the System Intake process.

Rather than relying on implicit relationships or free-text fields, this plugin creates a normalized `Additional Contact` record to clearly represent *who* is involved in a request and *how* they participate.

---

## Plugin Overview

### AdditionalContact_Create_ForRequester

**Purpose**  
Automatically creates an **Additional Contact** record for the primary requester when a new Request is created (or initialized), assigning them an explicit role in the intake process.

This ensures that:
- all participants are modeled consistently
- requester involvement is visible and queryable
- downstream logic can rely on structured relationships instead of assumptions

**Trigger**
- Entity: `new_systemintake` (Request)
- Message: `Create`
- Stage: **PostOperation (40)**
- Mode: **Synchronous**

*(Exact trigger may vary slightly depending on environment, but the plugin is designed to run after the Request exists.)*

---

## Behavior

When a Request is created:

1. The plugin identifies the **primary requester** (Contact)
2. It creates a related **Additional Contact** record
3. The record:
   - links back to the Request
   - references the Contact
   - assigns a role indicating the requester’s participation in the process (e.g. “Requester”)

This guarantees that the requester is always included in the same data model as other participants (approvers, admins, reviewers, etc.).

---

## Why This Exists

Without this plugin:
- the requester exists only implicitly on the Request
- additional participants use a different representation
- role-based logic becomes inconsistent
- UX and reporting require special-case handling

With this plugin:
- **all participants are modeled the same way**
- roles are explicit
- future extensions (notifications, permissions, routing) are simpler
- auditability and clarity improve

---

## Design Principles

- **Normalize early**  
  Participants are first-class records, not inferred relationships.
- **Single source of truth**  
  Roles live on the Additional Contact entity, not scattered across fields.
- **PostOperation safety**  
  The Request must exist before related records are created.

---

## Deployment Notes

- Built as part of the `SystemIntake.Plugins.dll` assembly
- Registered as a separate plugin step
- Target framework: **.NET Framework 4.7.1**
- Language level: **C# 7.3**

---

## Future Enhancements (Optional)

- Prevent duplicate Additional Contact records for the same Contact + Request
- Support additional roles (e.g. Approver, Reviewer, Delegate)
- Sync role changes if the primary requester changes
- Validation to ensure at least one requester role always exists

---

