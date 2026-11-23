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

Each environment file is a readable JSON object whose display names map
directly to values. `InitialITGO` contains the application environment
variables. `ITGODataMigrationsDataflows` contains the staging, migration, and
expected dataflow configuration variables. Each solution's `schema.json` maps
those display names to the immutable schema names PAC requires.

Embedded migration configurations are stored as nested JSON objects rather
than escaped JSON strings. This keeps them readable and allows the object value
to be copied into the Power Platform UI. The PAC generator serializes each
nested object to the string representation required by environment variables.

The checked-in files are source configuration, not PAC input. Generate a PAC
settings file during the readiness check and pass that generated file to PAC.
Connection references are intentionally omitted because this repository does
not manage their environment bindings.

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
strict readiness check. Add `--output` to generate the PAC-compatible file:

```bash
npm run deployment-settings:ready -- InitialITGO uat \
  --output /tmp/InitialITGO-uat.settings.json
npm run deployment-settings:ready -- ITGODataMigrationsDataflows uat \
  --output /tmp/ITGODataMigrationsDataflows-uat.settings.json
```

The output path must not already exist, protecting an existing prepared file
from accidental overwrite.

If placeholders or secret values are populated in an untracked deployment
copy, validate that exact materialized file while still comparing its inventory
with the checked-in solution templates:

```bash
npm run deployment-settings:ready -- InitialITGO uat \
  --file <materialized-settings.json>
```

Readiness fails for empty variable values, `__REQUIRED__`,
`__SECRET_REQUIRED__`, invalid embedded JSON, mismatched environment IDs, blank
dataflow IDs, and dataflow configuration values over Power Platform's
2,000-character limit.

## Secrets

Never commit passwords, client secrets, API keys, access tokens, certificates,
or authenticated URLs. Replace secret placeholders only in an untracked
deployment copy populated by the approved secret-management process. Do not
commit that materialized copy.

## Importing a solution

After the readiness check generates or validates a PAC settings file, import
the matching solution ZIP using that same file:

```bash
pac solution import \
  --environment https://itgovernanceuat.crm9.dynamics.com \
  --path <solution.zip> \
  --settings-file /tmp/InitialITGO-uat.settings.json
```

Connection references are deliberately not configured by these files. They
must already be bound or be handled by the environment's separate deployment
process. Never copy a dataflow ID from one environment to another.

## Updating values

When a solution adds or removes environment variables:

1. Export a fresh unmanaged solution ZIP from DEV.
2. Generate a temporary skeleton with
   `pac solution create-settings --solution-zip <solution.zip> --settings-file <temporary.json>`.
3. Reconcile its environment-variable inventory with the solution's
   `schema.json` and all three checked-in files.
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
kept as readable validation inputs, and their compact values are embedded only
in the `ITGODataMigrationsDataflows` settings. Migration-owned variables must
not be included in `InitialITGO`, because doing so creates a cross-solution
managed value layer that can block removal of the migration solution.

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
