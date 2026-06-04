# LCID Plugin

Dataverse plugin for creating LCID activity log entries when tracked LCID fields are updated.

## Purpose

This plugin listens for updates to LCID records and creates an LCID Activity Log record when one or more tracked fields change.

## Trigger

Register this plugin on:

- Message: `Update`
- Table: `cr69a_lifecycleids`
- Stage: Post-operation is recommended
- Mode: Synchronous or asynchronous, depending on desired UX/logging behavior
- Pre-image name: `PreImage`
- Pre-image columns: `cr69a_retiresat`, `cr69a_lcidexpiresat`, `cr3ee_scope`, `cr3ee_costbaseline`

## Tracked fields

The plugin currently logs changes to:

- `cr69a_retiresat` - Retires At
- `cr69a_lcidexpiresat` - Expiration Date
- `cr3ee_scope` - Scope
- `cr3ee_costbaseline` - Cost Baseline

## Behavior

When a tracked field is present in the update target, the plugin creates a `new_lcidactivitylog` record linked to the LCID.

The activity log includes:

- LCID lookup: `new_lcid`
- Activity type: `100000002` / Update
- Action: `Update`
- Reason: `LCID fields updated directly.`
- Structured before/after values in the matching `new_lcid*old` and `new_lcid*` fields
- Additional information: formatted list of actual changes from old value to new value

## Notes

- Exits early if the execution depth is greater than 1.
- Exits if no tracked fields are included in the update.
- Ignores tracked fields included in the request when their values did not actually change.
- Requires a pre-image named `PreImage` containing all four tracked fields.
- Formats dates, booleans, option sets, money values, strings, and null values for readability.
- Long string values are truncated to 500 characters.
