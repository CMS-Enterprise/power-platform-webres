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

For local development, the command continues to use `TENANT_ID`, `CLIENT_ID`,
`CLIENT_SECRET`, and `DATAVERSE_URL` from `.env`. In GitHub Actions, the PR
check uses a dedicated, read-only, Dev-only federated identity. The workflow
acquires a short-lived token through GitHub OIDC and passes it to the checker as
`DATAVERSE_ACCESS_TOKEN`; no client secret is stored in GitHub.

The workflow requires these non-secret GitHub repository variables:

- `AZURE_CLIENT_ID`: client ID of the dedicated Dev CI identity
- `AZURE_TENANT_ID`: Microsoft Entra tenant containing that identity
- `DATAVERSE_DEV_URL`: URL of the Dev Dataverse environment

The federated credential must restrict trust to this repository and the GitHub
events used by the workflow. The corresponding Dataverse application user
should have only the permissions needed to read published web resources in
Dev. UAT and Prod credentials are neither required nor used.

## Auditing environment access

Use the read-only `WhoAmI` probe to verify whether the service principal in
your local `.env` can access a specific environment:

```bash
npm run dataverse:access:check -- --url https://example.crm.dynamics.com
```

The environment URL must be supplied explicitly. The command does not use or
modify `DATAVERSE_URL`, read business records, or change the environment. It
prints `ACCESS_GRANTED` when Dataverse recognizes the application user and
`ACCESS_DENIED` after that environment's access has been removed. Removing an
application user or its roles should only be done after confirming that no
flows, integrations, or deployment processes depend on it.
