# Plugins

This directory contains Dataverse plugins specific to the IT Governance application.

Each plugin should live in its own folder and include:

- Source code
- Project file (`.csproj`)
- Strong name key (`.snk`)
- A README describing behavior and registration details

## Expectations

Plugin folders should document:

- Message (Create, Update, etc.)
- Primary entity
- Execution stage (Pre/Post Operation)
- Sync vs async
- Any important assumptions or edge cases

This helps future developers understand and safely modify plugin behavior.
