# Activity Log Governance Plugins

This folder contains Dataverse plugins that enforce **process governance, validation, and synchronization** when Activity Logs (`new_activitylogs`) are created as part of the System Intake workflow.

These plugins ensure that:

- process steps are updated consistently across Review and Request records
- audit logs are immutable
- invalid or no-op explicit process step changes are blocked server-side
- review state flags are kept in sync

All plugins are deployed as part of the same assembly (`ActivityLogs.Plugins.dll`) but are registered as separate plugin steps.

`ActivityLog_Create_ValidateActivityType` applies the current-step validation only to the explicit **Progress to step** activity type. **Edit Request** activity logs may target the current step so they can record the requested edits and clear Ready for Review without requiring an artificial process transition.

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

**Issue a Lifecycle ID behavior**

- If `cr3ee_lifecycleid = 216640000`, creates a new `cr69a_lifecycleids` record.
- If `cr3ee_lifecycleid = 216640001`, retrieves the existing `cr3ee_lcid` lookup to confirm it exists.
- Links the new or existing LCID to both the related Request and Admin Review.
- Records the issue decision on both records.
- Marks the Request as closed with `cr69a_status = 100000000`.
- Generated LCID names use the EASi raw 7-digit format `YYdddPP`.

**Final decision behavior**

- Not an IT Governance Request, Not approved by GRB, and Close Request all:
  - move Request and Review to Finished
  - record the matching decision
  - copy the Activity Log closing reason and next steps to the Request
  - clear Ready for Review on both records
  - mark the Request closed
  - mark the Admin Review complete

**Re-open Request behavior**

- Moves Request and Review back to Draft.
- Clears prior Request decision date, decision, decision reason, and next steps.
- Clears prior Admin Review decision and decision date.
- Clears Ready for Review on both records.
- Marks the Admin Review incomplete.

This plugin replaces the old `ActivityLog_Create_SyncTargetStepToReviewAndRequest` registered step. Keep the old class in the assembly for rollback context, but disable its step after registering this router.

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

---

---

### 4. LifecycleId_SetDisplayName

**Purpose**
Keeps the LCID primary name field formatted for admin-facing lookup display.

**Trigger**

- Entity: `cr69a_lifecycleids`
- Message: `Create` and `Update`
- Stage: PreOperation (20)
- Mode: Synchronous

**Behavior**

- Reads `cr3ee_rawlcid` plus LCID display metadata.
- Sets `cr69a_lcid` to `rawLCID-component-type-shortened-lowIT`.
- Omits missing metadata and false/blank booleans.
- Falls back to the raw LCID when no metadata exists.
- Preserves the existing primary name as-is when a legacy record has no raw LCID, preventing formatted segments from being appended twice.

---

## Issue LCID Details

### Creating a new LCID

When the Activity Log says to create a new LCID:

- Entity: `cr69a_lifecycleids`
- Primary name field: `cr69a_lcid`
- Raw LCID field: `cr3ee_rawlcid`
- Name format: `YYdddPP`
  - `YY` = last two digits of the Eastern calendar year
  - `ddd` = Eastern day-of-year, zero-padded to 3 digits
  - `PP` = count of existing generated LCIDs for that Eastern calendar day, zero-padded from `00` through `99`
- Numbering strategy:
  - convert `DateTime.UtcNow` to Eastern time using `Eastern Standard Time`
  - build the 5-character prefix, such as `26166` for the 166th day of 2026
  - query existing `cr3ee_rawlcid` values that start with the current Eastern prefix
  - append the zero-padded count of matching records as the final two sequence digits
  - throw a clear plugin error if the count is greater than `99`
- Daily limit: the EASi format supports at most 100 generated LCIDs per Eastern calendar day.
- Duplicate protection: configure a Dataverse alternate key on `cr69a_lifecycleids.cr3ee_rawlcid` so concurrent issuances cannot create duplicate raw LCIDs.

The new LCID receives:

- `cr3ee_rawlcid` = generated raw LCID
- `cr69a_lcid` = display name built from raw LCID and metadata
- `cr3ee_costbaseline` = Activity Log `cr3ee_projectcostbaseline`
- `cr69a_lcidexpiresat` = Activity Log `cr3ee_expirationdate`
- `cr69a_issuedat = DateTime.UtcNow`
- `cr3ee_lcidstatus = 216640000`
- `cr3ee_scope` = Activity Log `cr3ee_scopeofthelifecycleid`
- `new_lcidtype` = Activity Log `new_lcidtype`
- `new_lcidislowit` = Activity Log `new_lcidislowit`
- `new_lcidisshortened` = Activity Log `new_lcidisshortened`
- `new_lcidcomponent` = Activity Log `new_lcidcomponent`

Display name format:

- Base value is `cr3ee_rawlcid`.
- `new_lcidcomponent` is appended when present.
- `new_lcidtype` abbreviates `NEW_SYSTEM` to `NEW` and `RECOMPETE` to `RC`.
- `new_lcidisshortened = true` appends `S`.
- `new_lcidislowit = true` appends `L`.
- Example: `123456-OIT-NEW-S-L`.

Ownership is best-effort:

- Try to assign `ownerid` to the Team named `IT Governance Admin Team`.
- If that team is not found, trace the missing team and let Dataverse default ownership to the calling user.
- Missing team ownership should not block issuing the LCID.

### Updating the Request

The related Request (`new_systemintake`) receives:

- `new_admingovernanceprocessstep = 971270009`
- `cr3ee_decisiondate = DateTime.UtcNow`
- `easi_decision = 971270000`
- `cr69a_lcid` = new or existing LCID
- `cr3ee_nextsteps` = Activity Log `cr3ee_nextsteps`
- `cr69a_readyforreview = false`
- `cr69a_status = 100000000`

### Updating the Admin Review

The related Admin Review (`cr69a_systemintakeadmin`) receives:

- `new_admingovernancetasklist = 971270009`
- `cr69a_decision = 971270000`
- `cr69a_decisiondate = DateTime.UtcNow`
- `cr69a_lcid` = new or existing LCID
- `cr69a_readyforreview = false`
- `cr69a_systemintakecomplete = 971270000`

### Flow responsibilities that remain outside this plugin

Power Automate can continue to handle:

- email notification
- LCID activity log creation

Those actions can remain asynchronous and do not need to block the Request/Review state changes.

---

## Not an IT Governance Request Details

### Update the Request

The related Request (`new_systemintake`) receives:

- `new_admingovernanceprocessstep = 971270009`
- `cr3ee_decisiondate = DateTime.UtcNow`
- `easi_decision = 971270001`
- `cr3ee_decisionreason` = Activity Log `cr3ee_whyareyouclosingthisrequest`
- `cr3ee_nextsteps` = Activity Log `cr3ee_nextsteps`
- `cr69a_readyforreview = false`
- `cr69a_status = 100000000`

### Update the Review

The related Admin Review (`cr69a_systemintakeadmin`) receives:

- `new_admingovernancetasklist = 971270009`
- `cr69a_decision = 971270001`
- `cr69a_decisiondate = DateTime.UtcNow`
- `cr69a_readyforreview = false`
- `cr69a_systemintakecomplete = 971270000`

## Not approved by GRB Details

### Update the Request

The related Request (`new_systemintake`) receives:

- `new_admingovernanceprocessstep = 971270009`
- `cr3ee_decisiondate = DateTime.UtcNow`
- `easi_decision = 971270002`
- `cr3ee_decisionreason` = Activity Log `cr3ee_whyareyouclosingthisrequest`
- `cr3ee_nextsteps` = Activity Log `cr3ee_nextsteps`
- `cr69a_readyforreview = false`
- `cr69a_status = 100000000`

### Update the Review

The related Admin Review (`cr69a_systemintakeadmin`) receives:

- `new_admingovernancetasklist = 971270009`
- `cr69a_decision = 971270002`
- `cr69a_decisiondate = DateTime.UtcNow`
- `cr69a_readyforreview = false`
- `cr69a_systemintakecomplete = 971270000`

## Close Request Details

### Update the Request

The related Request (`new_systemintake`) receives:

- `new_admingovernanceprocessstep = 971270009`
- `cr3ee_decisiondate = DateTime.UtcNow`
- `easi_decision = 971270003`
- `cr3ee_decisionreason` = Activity Log `cr3ee_whyareyouclosingthisrequest`
- `cr3ee_nextsteps` = Activity Log `cr3ee_nextsteps`
- `cr69a_readyforreview = false`
- `cr69a_status = 100000000`

### Update the Review

The related Admin Review (`cr69a_systemintakeadmin`) receives:

- `new_admingovernancetasklist = 971270009`
- `cr69a_decision = 971270003`
- `cr69a_decisiondate = DateTime.UtcNow`
- `cr69a_readyforreview = false`
- `cr69a_systemintakecomplete = 971270000`

## Re-Open Request Details

### Update the Request

The related Request (`new_systemintake`) receives:

- `new_admingovernanceprocessstep = 971270006`
- `cr3ee_decisiondate = null`
- `easi_decision = null`
- `cr3ee_decisionreason = null`
- `cr3ee_nextsteps = null`
- `cr69a_readyforreview = false`
- `cr69a_status = 971270000`

### Update the Review

The related Admin Review (`cr69a_systemintakeadmin`) receives:

- `new_admingovernancetasklist = 971270006`
- `cr69a_decision = null`
- `cr69a_decisiondate = null`
- `cr69a_readyforreview = false`
- `cr69a_systemintakecomplete = 971270001`

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

- Build assembly: `ActivityLogs.Plugins.dll`
- Target framework: .NET Framework 4.7.1
- Register new steps:
  - `ActivityLog_Create_ValidateActivityType`: Create, `new_activitylogs`, PreOperation, synchronous
  - `ActivityLog_Create_ApplyActivityType`: Create, `new_activitylogs`, PostOperation, synchronous
  - `LifecycleId_SetDisplayName`: Create, `cr69a_lifecycleids`, PreOperation, synchronous
  - `LifecycleId_SetDisplayName`: Update, `cr69a_lifecycleids`, PreOperation, synchronous
- Disable old registered steps after the new steps are active:
  - `ActivityLog_Create_ValidateTargetStepNotCurrent`
  - `ActivityLog_Create_SyncTargetStepToReviewAndRequest`

---

## Related UX Considerations

- For explicit Progress to step actions, the Activity Log form disables selecting the current step to prevent no-op submissions
- Edit Request activity logs may target the current step
- Clear labels and helper text guide users through step changes
- Server-side validation remains in place as a safety net

---

## Future Enhancements (Optional)

- Block `Delete` on Activity Logs
- Role-based exceptions for admin corrections
- Plugin trace logging for diagnostics
- Additional validation based on Activity Log type

---
