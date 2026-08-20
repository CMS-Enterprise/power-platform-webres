# Edit Request Plugin

This project contains the Dataverse plugin that handles Edit Request (`cr69a_editrequest`) submissions for the IT Governance workflow.

## Plugin

### EditRequest_Create_SetRequestAdminGovernanceStep

Creates an Activity Log (`new_activitylogs`) when an Edit Request asks for changes to a specific form. The Activity Log is then handled by the existing Activity Log governance plugins, which update the related Review and Request process steps and clear Ready for Review.

The class name is retained for registration compatibility, but the plugin no longer updates Review or Request records directly.

## Registration

- Assembly: `EditRequest.dll`
- Plugin type: `EditRequest.EditRequest_Create_SetRequestAdminGovernanceStep`
- Message: `Create`
- Primary table: `cr69a_editrequest`
- Stage: `PostOperation (40)`
- Mode: `Synchronous`
- Images: none required

## Source Fields

The plugin reads these fields from the Edit Request Target:

- `cr69a_batchid`
- `cr69a_whichformneedsedits`
- `cr69a_systemintake`
- `cr69a_systemintakeadmin`

If `cr69a_batchid` is populated, the Edit Request was created by a data migration. The plugin exits without creating an Activity Log or changing related Request and Review state.

Both Request and Review lookups are required. If either lookup is missing or has an empty ID, the plugin exits before creating an Activity Log so the related records cannot drift out of sync.

## Activity Log Created

For mapped form choices, the plugin creates `new_activitylogs` with:

- `new_systemintake` = Edit Request Request lookup
- `new_adminreview` = Edit Request Review lookup
- `new_process_target_step` = mapped target process step
- `cr3ee_activitytype` = Edit Request (`216640005`)
- `new_activity` = generated note describing the Edit Request target form and mapped step label
- `new_activityby` = submitting user (`context.InitiatingUserId`, falling back to `context.UserId`)
- `new_whichformneedsedits` = Edit Request form choice
- `new_whatchangesareneeded` = copied from Edit Request `cr3ee_changes_needed` when present
- `new_additionalinformation` = copied from Edit Request `cr3ee_additionalinformation` when present
- `new_adminnote` = copied from Edit Request `cr69a_adminnotes` when present

The Activity Log fields use different logical names from the Edit Request source fields, so the plugin copies the audited Edit Request source columns into the `new_...` Activity Log columns.

The existing Activity Log plugins perform the actual Review and Request updates:

- Review.`new_admingovernancetasklist`
- Request.`new_admingovernanceprocessstep`
- Review.`cr69a_readyforreview = false`
- Request.`cr69a_readyforreview = false`

## Mapping

| Edit Request choice | Value | Activity Log target step |
| --- | ---: | ---: |
| Intake Request Form | `971270000` | `971270006` |
| Draft Business Case | `971270001` | `971270001` |
| Final Business Case | `971270002` | `971270003` |
| No Target Provided | `971270003` | No Activity Log created |

## Build

Build the Release DLL before registration:

```powershell
dotnet build EditRequest\EditRequest.sln -c Release
```

Upload this DLL in the Plugin Registration Tool:

```text
EditRequest\EditRequest\bin\Release\EditRequest.dll
```

## Manual Test Checklist

- A migrated Edit Request with `cr69a_batchid` populated creates no Activity Log and changes no related state.
- Intake Request Form creates an Edit Request Activity Log targeting `971270006`.
- Draft Business Case creates an Edit Request Activity Log targeting `971270001`.
- Final Business Case creates an Edit Request Activity Log targeting `971270003`.
- No Target Provided creates no Activity Log and changes no steps.
- Missing Request creates no Activity Log.
- Missing Review creates no Activity Log.
- Created Activity Logs use `cr3ee_activitytype = 216640005`.
- Created Activity Logs include a generated note in `new_activity`.
- Created Activity Logs set `new_activityby` to the submitting user.
- Created Activity Logs copy `new_whichformneedsedits`, `new_whatchangesareneeded`, `new_additionalinformation`, and `new_adminnote` from the Edit Request.
- Created Activity Logs update both Review and Request through the Activity Log plugins.
