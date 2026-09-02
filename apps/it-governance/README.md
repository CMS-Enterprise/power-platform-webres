# IT Governance Power App

This folder contains all application-specific resources for the IT Governance Power Platform solution.

The goal is to keep the application components that are useful for code review and change tracking in one place.

## Solution snapshot

`solution/` is a reviewable snapshot exported from Power Platform. It improves visibility into app changes, but it is intentionally not a complete, repackable solution and is not the deployment source of truth.

The export process excludes `InitialITGO/src/Other/Customizations.xml`. That monolithic, environment-generated file contains opaque runtime metadata such as dataflow refresh history, which can embed temporary bearer credentials in diagnostic URLs. It also excludes environment-variable runtime value files and the environment-specific `new_DataflowConfiguration` definition, whose default value contains development dataflow IDs. Environment-variable schemas without runtime values remain reviewable. Useful extracted components—such as entities, workflows, web resources, app modules, option sets, roles, and plug-in metadata—remain available for review.

Power Platform remains the deployment source. Before committing a refreshed snapshot, review the complete diff and run the repository's approved secret-scanning controls. Exported workflows must not contain presigned URLs, SAS URLs, access tokens, passwords, or other credentials.

## Structure

- `docs/`
  - Architecture notes, form behavior, and deployment guidance
  - See `docs/web-resource-deployment.md` for the local web resource deploy workflow
- `migrations/`
  - One-time or scripted data migrations
- `plugins/`
  - Dataverse plugins specific to IT Governance
- `web-resources/`
  - JavaScript, HTML, CSS, images used in model-driven forms

## Design philosophy

- App-specific code lives here by default
- Reuse is encouraged, but only after it is proven
- Readability and maintainability are prioritized over abstraction
- Folder names should map clearly to Power Platform concepts

If a component becomes reusable across multiple apps, it may later be promoted to the `/shared` folder.
