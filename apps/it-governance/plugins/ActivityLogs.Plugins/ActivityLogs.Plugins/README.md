# Activity Log Governance Plugins

This folder contains Dataverse plugins that enforce **process governance, validation, and synchronization** when Activity Logs (`new_activitylogs`) are created as part of the System Intake workflow.

These plugins ensure that:
- process steps are updated consistently across Review and Request records
- audit logs are immutable
- invalid or no-op step changes are blocked server-side
- review state flags are kept in sync

All plugins are deployed as part of the same assembly (`ActivityLogs.Plugins.dll`) but are registered as separate plugin steps.

---

## Plugin Overview

### 1. ActivityLog_Create_SyncTargetStepToReviewAndRequest

**Purpose**  
Synchronizes the target process step from an Activity Log into the related:
- Admin Review (`cr69a_systemintakeadmin`)
- Request (`new_systemintake`)

It also clears the **Ready for Review** flag on both records, indicating that admin review is no longer pending once an action has been taken.

**Trigger**
- Entity: `new_activitylogs`
- Message: `Create`
- Stage: **PostOperation (40)**
- Mode: **Synchronous**

**Behavior**
- Copies `new_process_target_step` →
  - Review.`new_admingovernancetasklist`
  - Request.`new_admingovernanceprocessstep`
- Sets:
  - Review.`cr69a_readyforreview = false`
  - Request.`cr69a_readyforreview = false`

This plugin performs the authoritative state change after an Activity Log is committed.

---

### 2. ActivityLog_Create_ValidateTargetStepNotCurrent

**Purpose**  
Prevents creation of Activity Logs that attempt to change the process to the **same step it is already in**.

This avoids no-op logs, redundant processing, and accidental user errors.

**Trigger**
- Entity: `new_activitylogs`
- Message: `Create`
- Stage: **PreOperation (20)**
- Mode: **Synchronous**

**Behavior**
- Reads the target step from the Activity Log
- Retrieves the current step from the related Admin Review
- Throws an exception if the target step equals the current step

This plugin runs *before* the Activity Log is created and blocks invalid requests early.

---

### 3. ActivityLog_Update_BlockAll

**Purpose**  
Enforces immutability of Activity Logs.

Once an Activity Log is created, it may not be edited. Corrections must be made by creating a new Activity Log entry.

**Trigger**
- Entity: `new_activitylogs`
- Message: `Update`
- Stage: **PreOperation (20)**
- Mode: **Synchronous**

**Behavior**
- Throws an exception on any update attempt
- Prevents UI edits, API updates, and automation-based changes

This ensures Activity Logs remain a reliable audit trail.

---

## Design Principles

- **Server-side enforcement first**  
  Client-side JavaScript is used for UX, but plugins are the source of truth.
- **Immutable audit records**  
  Activity Logs represent historical actions and should never change.
- **Clear separation of concerns**
  - Validation (PreOperation)
  - State mutation (PostOperation)
  - Audit protection (PreOperation)

---

## Deployment Notes

- All plugins are built into a single assembly: `ActivityLogs.Plugins.dll`
- Each class is registered as a separate plugin step in Dataverse
- Target framework: **.NET Framework 4.7.1**
- Language level: **C# 7.3**

---

## Related UX Considerations

- The Activity Log form disables selecting the current step to prevent no-op submissions
- Clear labels and helper text guide users through step changes
- Server-side validation remains in place as a safety net

---

## Future Enhancements (Optional)

- Block `Delete` on Activity Logs
- Role-based exceptions for admin corrections
- Plugin trace logging for diagnostics
- Additional validation based on Activity Log type

---

