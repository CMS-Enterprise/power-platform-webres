# IT Governance deployment configuration

This folder is the human-readable source of truth for non-secret values that vary by Power Platform environment. Each JSON file is intentionally flat, uses the Power Platform display names as keys where applicable, and keeps the keys alphabetized for quick lookup during deployment.

Use the environment file before exporting, importing, configuring, or validating a deployment:

- `dev.json`
- `uat.json`
- `prod.json`

The files intentionally reference the existing migration dataflow configuration files rather than duplicating their frequently changing IDs. JSON objects are formally unordered, but these files maintain alphabetical source order for readability.

## Safe to store here

- Dataverse environment URLs and environment IDs
- SharePoint site URLs, document-library names, and library IDs
- Dataverse record IDs such as the parent SharePoint Document Location
- Environment-variable schema names and their non-secret values
- Paths to other committed deployment configuration files
- Connection-reference logical names

## Never store here

- Passwords, client secrets, API keys, or access tokens
- SharePoint or Dataverse credentials
- SAS URLs or other URLs containing authentication material
- Private certificates or certificate passwords

Use an approved secret store and deployment process for sensitive values.

## SharePoint document provisioning

The `Sharepoint Document Provisioning` cloud flow uses these solution environment variables:

| Schema name | Purpose |
| --- | --- |
| `new_SharePointSiteUrl` | SharePoint site used by the folder and permission actions |
| `new_SharePointDocumentLibraryId` | SharePoint document-library GUID used by the folder and permission actions |
| `new_SharePointParentDocumentLocationID` | Dataverse `sharepointdocumentlocation` record representing the environment's Request document library |

The parent Document Location should have:

- Parent Site or Location: the environment's `Default Site` SharePoint Site record
- Relative URL: the document-library display name, such as `IT GO Docs UAT`
- Absolute URL: blank/calculated
- Regarding: blank

Do not include environment-specific current values when exporting the solution. Set them during import or immediately afterward, then save or reactivate the flow so it reads the new values.

## Deployment checklist

1. Review the target environment file and resolve every `null` value marked as not configured.
2. Publish all customizations in the source environment.
3. Export and deploy the application solution.
4. Set the target environment-variable current values.
5. Configure the Dataverse and SharePoint connection references.
6. Save or turn the provisioning flow off and on after changing environment-variable values.
7. Create one test Request and verify folder creation, requester access, Document Location creation, provisioning status, and document upload.
8. Use the referenced migration files when configuring or validating dataflows.
