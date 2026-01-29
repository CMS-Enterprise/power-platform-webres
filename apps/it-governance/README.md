# IT Governance Power App

This folder contains all application-specific resources for the IT Governance Power Platform solution.

The goal is to keep **everything needed to understand, modify, and deploy this app** in one place.

## Structure

- `docs/`
  - Architecture notes, form behavior, and deployment guidance
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
