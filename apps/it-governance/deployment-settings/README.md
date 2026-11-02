# IT Governance deployment settings

This directory is the source of truth for non-secret Power Platform environment
variable values. Files are grouped by solution unique name and then target environment:

```text
deployment-settings/
  InitialITGO/
    dev.json
    uat.json
    prod.json
  ITGODataMigrationsDataflows/
    dev.json
    uat.json
    prod.json
```

Each file uses the PAC deployment-settings format and can be supplied to
`pac solution import --settings-file`. `InitialITGO` contains the application
environment variables. `ITGODataMigrationsDataflows` contains the staging,
migration, and expected dataflow configuration variables.

Every variable includes a friendly `Name.Default` for people and the immutable
`SchemaName` PAC requires during import. Connection references are intentionally
empty because this repository does not manage their environment bindings.

The schema inventories were generated from fresh DEV solution exports. The
non-secret Dev and UAT values were read from their deployed environments. The
deployment service account cannot read Prod environment variables, so known
Prod migration values are present and unavailable values are marked
`__REQUIRED__`.

## Validation

Run the structural check after editing any deployment settings file:

```bash
npm run deployment-settings:check
```

This permits documented placeholders so incomplete target templates can remain
in source control. Before deploying one solution to one environment, run the
strict readiness check:

```bash
npm run deployment-settings:ready -- InitialITGO uat
npm run deployment-settings:ready -- ITGODataMigrationsDataflows uat
```

Readiness fails for empty variable values, `__REQUIRED__`,
`__SECRET_REQUIRED__`, invalid embedded JSON, mismatched environment IDs, blank
dataflow IDs, and dataflow configuration values over Power Platform's
2,000-character limit.

## Secrets

Never commit passwords, client secrets, API keys, access tokens, certificates,
or authenticated URLs. `new_CedarAPIKeyDev` is intentionally stored as
`__SECRET_REQUIRED__` even when the target environment already has a value.
Replace secret placeholders only in an untracked deployment copy populated by
the approved secret-management process. Do not commit that materialized copy.

## Importing a solution

After the readiness check passes for the materialized settings file, import the
matching solution ZIP:

```bash
pac solution import \
  --environment https://itgovernanceuat.crm9.dynamics.com \
  --path <solution.zip> \
  --settings-file apps/it-governance/deployment-settings/InitialITGO/uat.json
```

Connection references are deliberately not configured by these files. They
must already be bound or be handled by the environment's separate deployment
process. Never copy a dataflow ID from one environment to another.

## Updating values

When a solution adds or removes environment variables:

1. Export a fresh unmanaged solution ZIP from DEV.
2. Generate a temporary skeleton with
   `pac solution create-settings --solution-zip <solution.zip> --settings-file <temporary.json>`.
3. Reconcile its environment-variable inventory with all three checked-in files;
   leave `ConnectionReferences` empty.
4. Preserve target-specific values and use the documented placeholders for
   anything not yet known.
5. Run the structural check and the relevant readiness check.

When a migration dataflow is created or recreated, obtain its **Power Automate
dataflow ID** (`msdyn_originaldataflowid`), not its Dataverse record ID. Update
the appropriate embedded `Dataflows` object in the migration solution file and
keep its `EnvironmentId` unchanged. The embedded JSON is compact because the
entire value must fit within 2,000 characters.

The migration expected-configuration source files remain under
`migrations/dataflows/migration-dataflow-expected-configurations`. They are
kept as readable validation inputs and their compact values are also embedded
in both solution settings where PAC requires them.

The SharePoint document-library display name is deployment metadata rather
than a solution environment variable, so it cannot be placed in the PAC JSON.
The known names are retained here:

| Environment | Document library |
| --- | --- |
| Dev | `IT GO Docs DEV` |
| UAT | `IT GO Docs UAT` |
| Prod | `__REQUIRED__` |

## Values requiring review

- All Prod application values marked `__REQUIRED__` need a privileged inventory
  before Prod deployment.
- Prod has no locally recorded `StageNotes` dataflow ID; it is represented by
  `__REQUIRED__` so the solution inventories stay aligned and readiness fails.
- UAT currently stores its Power Platform environment ID in `new_AppId`. This
  file preserves the deployed value, but the application ID should be verified
  before the next UAT import.
