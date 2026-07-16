# LCID Activity Logs Plugin

Dataverse plugin for applying LCID status changes when LCID Activity Log records are created.

## Purpose

This plugin listens for new LCID Activity Log records and updates the related LCID record when the activity log represents a retire or unretire action.

## Trigger

Register this plugin on:

- Message: `Create`
- Table: `new_lcidactivitylog`
- Stage: Post-operation is recommended
- Mode: Synchronous or asynchronous, depending on desired UX/logging behavior

## Supported activity types

The plugin currently handles:

- `100000000` � Retire
- `100000001` � Unretire

## Behavior

When an LCID Activity Log is created, the plugin checks the related LCID and activity type.

For **Retire**, it updates the LCID with:

- `cr3ee_lcidstatus` = Retired
- `cr3ee_retiredat` = current UTC date/time

For **Unretire**, it updates the LCID with:

- `cr3ee_lcidstatus` = Issued
- `cr3ee_retiredat` = cleared

It also copies these fields from the activity log back to the LCID when provided:

- `new_lcidcostbaseline` to `cr3ee_costbaseline`
- `new_lcidscope` to `cr3ee_scope`
- `new_lcidexpirationdate` to `cr69a_lcidexpiresat`
- `new_lcidretiredate` to `cr69a_retiresat`
- `new_lcidtype` to `new_lcidtype`
- `new_lcidislowit` to `new_lcidislowit`
- `new_lcidisshortened` to `new_lcidisshortened`
- `new_lcidcomponent` to `new_lcidcomponent`

Before applying each Edit field, the plugin retrieves its current LCID value and stores it in the matching old-value field:

- `new_lcidcostbaselineold`
- `new_lcidscopeold`
- `new_lcidexpirationdateold`
- `new_lcidretiredateold`

Only fields included in the Edit are given before/after values when an old-value field exists. The LCID display metadata fields do not currently have old-value fields, so they are copied directly when present. Explicitly cleared Edit values are copied as null. Edit logs without any editable fields do not update the LCID.

Activity Log Reason and Additional Information remain on the activity log and are never copied to the LCID.

## Notes

- Exits early if the execution depth is greater than 1.
- Exits if the activity log does not reference an LCID.
- Exits if the activity type is missing or unsupported.
- Uses plugin tracing to record execution details and troubleshooting information.