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

## Synchronization checks

`npm run webres:check` compares every manifest-managed local web resource with
the version currently published in the configured Dataverse environment.

The command uses `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`, and `DATAVERSE_URL`
from the local `.env` file. Before opening or updating a pull request that
changes web resources, run the command against Dev and include its summary in
the PR's **How to test this change** section.

A clean result confirms that all manifest-managed files match published Dev. If
differences are intentional—for example, work is still in progress or Dev has
shared changes from another developer—list the differing resources and explain
the expected difference in the PR. This check is performed locally; GitHub does
not receive Dataverse credentials and does not connect to UAT or Prod.
