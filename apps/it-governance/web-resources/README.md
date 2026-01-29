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
