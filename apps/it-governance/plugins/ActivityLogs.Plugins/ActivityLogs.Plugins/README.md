# Activity Log Governance Plugins

This folder contains Dataverse plugins that enforce process governance, validation, and synchronization when Activity Logs (`new_activitylogs`) are created as part of the System Intake workflow.

These plugins ensure that:
- process steps are updated consistently across Review and Request records
- Activity Log actions apply their related Request, Review, and LCID changes immediately
- audit logs are immutable
- invalid or no-op step changes are blocked server-side
- review state flags are kept in sync

All plugins are deployed as part of the same assembly (`ActivityLogs.Plugins.dll`) but are registered as separate plugin steps.

---

## Activity Type Routing

Activity Log behavior is routed by `new_activitylogs.cr3ee_activitytype`.

| Activity Type | Option Value | Current Plugin Behavior |
| --- | ---: | --- |
| Progress to a new Step | `216640000` | Syncs the target process step to the related Admin Review and Request. |
| Issue a Lifecycle ID | `216640001` | Creates or reuses an LCID, links it to the related Admin Review and Request, records the decision, and closes the Request. |
| Not an IT Governance Request | `216640002` | Records the final decision, closes the Request, and marks the Admin Review complete. |
| Not approved by GRB | `216640003` | Records the GRB rejection decision, closes the Request, and marks the Admin Review complete. |
| Close Request | `216640004` | Records the close decision, closes the Request, and marks the Admin Review complete. |
| Edit Request | `216640005` | Not used in this plugin context; plugin traces and exits. |
| Re-open Request | `216640006` | Returns the Request and Admin Review to Draft and clears prior decision fields. |

---

## Plugin Overview

### 1. ActivityLog_Create_ValidateActivityType

**Purpose**  
Validates Activity Log actions before the Activity Log is created.

**Trigger**
- Entity: `new_activitylogs`
- Message: `Create`
- Stage: PreOperation (20)
- Mode: Synchronous

**Behavior**
- For Progress to a new Step:
  - reads `new_process_target_step`
  - retrieves the current Admin Review step from `cr69a_systemintakeadmin.new_admingovernancetasklist`
  - blocks creation if the target step equals the current step
- For Issue a Lifecycle ID:
  - requires `cr3ee_lifecycleid`
  - requires `new_adminreview`
  - requires `new_systemintake`
  - if `cr3ee_lifecycleid = 216640000`, requires `cr3ee_expirationdate`
  - if `cr3ee_lifecycleid = 216640001`, requires `cr3ee_lcid`
- For Not an IT Governance Request, Not approved by GRB, and Close Request:
  - requires `new_adminreview`
  - requires `new_systemintake`
  - requires `cr3ee_whyareyouclosingthisrequest`
- For Re-open Request:
  - requires `new_adminreview`
  - requires `new_systemintake`

This plugin replaces the old `ActivityLog_Create_ValidateTargetStepNotCurrent` registered step. Keep the old class in the assembly for rollback context, but disable its step after registering this validator.

---

### 2. ActivityLog_Create_ApplyActivityType

**Purpose**  
Applies Activity Log actions after the Activity Log is committed.

**Trigger**
- Entity: `new_activitylogs`
- Message: `Create`
- Stage: PostOperation (40)
- Mode: Synchronous

**Progress to a new Step behavior**
- Copies `new_process_target_step` to:
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
- Stage: PreOperation (20)
- Mode: Synchronous

**Behavior**
- Throws an exception on any update attempt when enabled
- Prevents UI edits, API updates, and automation-based changes

---

## Issue LCID Details

### Creating a new LCID

When the Activity Log says to create a new LCID:

- Entity: `cr69a_lifecycleids`
- Primary name field: `cr69a_lcid`
- Name format: `LC-{EasternYear}-{nextNumber}`
- Numbering strategy:
  - query existing `cr69a_lcid` values that start with the current Eastern year prefix, such as `LC-2026-`
  - parse the numeric suffix
  - add 1 to the highest parsed suffix
  - do not zero-pad the generated number

The new LCID receives:
- `cr69a_lcid` = generated LCID name
- `cr3ee_costbaseline` = Activity Log `cr3ee_projectcostbaseline`
- `cr69a_lcidexpiresat` = Activity Log `cr3ee_expirationdate`
- `cr69a_issuedat = DateTime.UtcNow`
- `cr3ee_lcidstatus = 216640000`
- `cr3ee_scope` = Activity Log `cr3ee_scopeofthelifecycleid`

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


## Deployment Notes

- Build assembly: `ActivityLogs.Plugins.dll`
- Target framework: .NET Framework 4.7.1
- Register new steps:
  - `ActivityLog_Create_ValidateActivityType`: Create, `new_activitylogs`, PreOperation, synchronous
  - `ActivityLog_Create_ApplyActivityType`: Create, `new_activitylogs`, PostOperation, synchronous
- Disable old registered steps after the new steps are active:
  - `ActivityLog_Create_ValidateTargetStepNotCurrent`
  - `ActivityLog_Create_SyncTargetStepToReviewAndRequest`

---

## Test Scenarios

- Progress to Step:
  - different target step updates Review and Request
  - same target step is blocked
  - Ready for Review is cleared on both records
- Issue LCID with new LCID:
  - missing `cr3ee_lifecycleid` blocks
  - missing expiration date blocks when creating new LCID
  - LCID is created, linked to Request/Review, and Request is closed
  - missing admin team does not block LCID creation
- Issue LCID with existing LCID:
  - missing `cr3ee_lcid` blocks
  - invalid or inaccessible LCID blocks clearly
  - existing LCID is linked to Request/Review without creating a duplicate
- Final decision actions:
  - missing Review, Request, or closing reason blocks
  - decision fields are set to the matching option values
  - Request is closed and Review is marked complete
- Re-open Request:
  - missing Review or Request blocks
  - decision fields and notes are cleared
  - Request and Review return to Draft
- Unsupported activity types:
  - plugin traces and exits without mutating Request/Review

---

## Future Enhancements

- Block `Delete` on Activity Logs.
- Remove retired plugin classes after the new router has proven stable in the environment.
