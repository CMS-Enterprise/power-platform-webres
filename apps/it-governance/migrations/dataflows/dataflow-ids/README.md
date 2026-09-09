# Dataflow IDs by environment

This directory records the environment-specific identifiers used by the System
Intake migration orchestration flow. The files provide a reviewable source for
the configuration that would otherwise exist only in Power Platform.

The files contain identifiers, not credentials. They do not grant access to an
environment and must not contain connection strings, tokens, client secrets, or
source-system credentials.

## File format

Each environment has one JSON file:

- `dev.json`
- `uat.json`
- `prod.json`

`EnvironmentId` is the Power Platform environment identifier supplied to the
Power Query Dataflows connector as `groupIdForRefreshDataflow`.

Each value under `Dataflows` is the identifier supplied to the connector as
`dataflowIdForRefreshDataflow`. In Dataverse, this corresponds to the
dataflow's `msdyn_originaldataflowid` value. It is **not** the Dataverse record
ID stored in `msdyn_dataflowid`.

The display names used as JSON keys must remain consistent with the migration
orchestration flow. Dataflow IDs are different in Dev, UAT, and Prod and must
never be copied from one environment to another.

## Updating an environment

Update the appropriate file whenever a migration dataflow is created,
recreated, or deployed to an environment:

1. Confirm that no migration is running and that publishing cannot consume
   unintended source or staging data.
2. Publish the dataflow in the target environment.
3. List the target environment's dataflows using the read-only local command:

   ```bash
   DATAVERSE_URL=https://<target-environment>.crm9.dynamics.com npm run dataflows:list
   ```

4. Locate the intended dataflow by name. If duplicate names exist, verify its
   owner, created/modified dates, M definition, mappings, and refresh history.
5. Copy the value labeled `Power Automate dataflow id` into the target JSON
   file. Do not copy the value labeled `Dataverse record id`.
6. Review the diff and confirm that only the intended environment and dataflow
   changed.
7. Copy the complete JSON object into that environment's migration
   configuration value.
8. Save or turn the orchestration flow off and on if necessary so that it reads
   the updated environment-variable value.
9. Test the affected orchestration path in the target environment.

An empty dataflow ID means the dataflow has not been verified for that
environment. Resolve every empty value required by the orchestration before
running a migration.

## Compact value for Power Platform

Power Platform's environment-variable value has a 2,000-character limit. The
checked-in files remain formatted for review; generate a compact value when
copying one into Power Platform:

```bash
node -e "const fs=require('node:fs'); process.stdout.write(JSON.stringify(JSON.parse(fs.readFileSync(process.argv[1], 'utf8'))))" apps/it-governance/migrations/dataflows/dataflow-ids/uat.json
```

Replace `uat.json` with the appropriate environment file. Do not create or
commit a second minified `.txt` copy.

## Deployment safety

- Treat these files as an inventory, not as proof that the deployed dataflows
  are correctly configured.
- Verify each dataflow's Dataverse URL, source location, credentials, load
  destinations, owner, and mappings after deployment.
- Keep real production source data unavailable until the production migration
  is authorized and ready to run.
- Do not deploy or publish migration dataflows while a Migration Run is marked
  `Running` or while unintended staged data is present.
- After a successful production rehearsal, freeze the deployed dataflows. Any
  subsequent deployment or configuration change requires revalidation and an
  update to this inventory.
