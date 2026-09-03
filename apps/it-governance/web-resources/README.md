# Web Resources

This directory contains client-side assets used by the IT Governance model-driven app.

## Contents

- `css/`  
  Styling for forms and embedded components
- `html/`  
  Embedded web resources such as headers, progress trackers, or custom UI
- `images/`  
  Icons and static assets
- `js/`  
  Form scripts, business logic, and UI coordination

## Notes

- Section visibility is controlled at the form level; ensure web resource controls themselves are visible
- JavaScript files are typically registered on specific forms or fields
- HTML web resources may depend on JavaScript functions exposed via `window`

Changes here should be reviewed carefully, as they directly affect the user experience.

## Auditing environment access

Use the read-only access probe to verify whether the service principal in your
local `.env` is recognized and can read web-resource metadata in a specific
environment:

```bash
npm run dataverse:access:check -- --url https://example.crm.dynamics.com
```

The environment URL must be supplied explicitly. The command does not use or
modify `DATAVERSE_URL`, read business records, or change the environment. It
reports identity recognition separately from web-resource read authorization.
After roles are removed, Dataverse may still recognize the identity while
reporting `WEB_RESOURCE_READ_DENIED` and `ACCESS_DENIED`. Removing an
application user or its roles should only be done after confirming that no
flows, integrations, or deployment processes depend on it.
