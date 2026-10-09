# Data Migration Guide

For the current end-to-end migration, validation, cutover, and rollback plan, see
[`data-migration-plan.md`](./data-migration-plan.md).

Migrating data between EASI and the IT Governance Power App should be handled by the following power automate flows.

1. Intake - Stage All Data
   - This job takes all of the csv data from EASI, which is stored in CSV files on sharepoint, and stores it into dataverse tables that are accessible by dataflows.
1. Intake - Migrate All Data
   - This job takes all data from staging tables and stores it in our real entity tables.

Rolling back the migrations can be accomplished by running the following flows:

1. Intake - Rollback Migration Data
   - This job takes a batch ID as an argument and deletes any data in the entity tables with the matching batch ID.
1. Intake - Rollback Staged Migration Data
   - This job removes all data from the staging tables

Migration order is important, as various records rely on others existing, but it has been written into these Power Automate flows.

Data migration details can be found in the [IT Governance Intake Request Mapping Workbook](https://docs.google.com/spreadsheets/d/1-TfJrVtfF5lW-SKITZK1plbBq_KQsQMUslB9jk5Pwbo/edit?usp=sharing)

## Dataflow source control

Dataflow M documents can be pulled from Dataverse into `./dataflows` for
source-control visibility. This tooling is intentionally read-only with respect
to Dataverse; make dataflow changes in the Power Apps dataflow editor, then pull
or check the local files.

```bash
npm run dataflows:list
npm run dataflows:pull
npm run dataflows:check
```

The dataflow manifest uses `dataflowId` values instead of names because some
DEV dataflows currently have duplicate display names.

### Dataflow IDs used by Power Automate

Dataverse stores more than one identifier for a dataflow. The Power Automate
dataflow refresh action requires the dataflow's `msdyn_originaldataflowid`; it
does not accept the `msdyn_dataflowid` of the corresponding Dataverse record.
Using `msdyn_dataflowid` causes the refresh action to fail with `Not Found` even
when the dataflow exists and can be refreshed manually.

`npm run dataflows:list` labels both values. Use **Power Automate dataflow id**
when configuring migration orchestration environment variables. Use
**Dataverse record id** only for the source-control manifest and direct queries
against the `msdyn_dataflows` Dataverse table.

Note: the committed `./dataflows/*.m` files are snapshots of what's currently in Dataverse,
including default parameter values (e.g., Dataverse URLs / SharePoint paths). Review and
update those parameters in the Power Apps dataflow editor when deploying to another
environment.

`dataflows:check` verifies the pulled `./dataflows` files match Dataverse.

### System Intake schema update

The current EASI export moved `priority_alignment` from `business_cases.csv` to
`system_intakes.csv`. The staging queries validate the complete CSV header so a
future export change fails with `CSV schema mismatch` instead of silently
shifting data into the wrong columns.

Before exporting the migration solution from DEV:

1. Add the text column `new_priorityalignment` to the System Intake staging
   table (the source values can be up to 2,000 characters).
2. In **Stage System Intakes**, map source `priority_alignment` to staging
   column `new_priorityalignment`.
3. In **Create Requests**, map `new_priorityalignment` to
   `new_organizationalpriorityalignment` on Request.
4. Remove the obsolete Business Case staging mapping for
   `priority_alignment`, if it is still present.
5. Refresh both dataflows in DEV, verify a populated Request value, then pull
   the dataflows into this repository and run `npm run dataflows:check`.

The other newly exported System Intake fields are parsed by the staging M
query, but intentionally remain unmapped until corresponding Dataverse targets
and migration requirements are agreed: digital-service interaction, external
protected-data access, current/contract cost estimates, and LCID metadata.

### Legacy requester phone schema update

The legacy `business_cases.csv` requester phone values are formatted text, not
numbers. Before exporting the migration solution from DEV:

1. In **Stage Business Cases**, map source `requester_phone_number` to the Text
   staging column `new_requestphonenumbertext`; leave the obsolete Float column
   `cr69a_requester_phone_number` unmapped.
2. In the downstream Business Case migration dataflow, map query output
   `new_requesterphonenumberlegacy` to the same-named field on System Intake.
   The M query derives that output from `new_requestphonenumbertext`.
3. Refresh the staging and downstream dataflows and verify a formatted phone
   number is retained on the corresponding System Intake record.

### Legacy feedback schema update

The legacy governance feedback export contains values longer than the original
100-character staging field. Before exporting the migration solution from DEV:

1. In **Stage Edit Requests**, map source `feedback` to the multiline staging
   column `new_requesterfeedbackmultitext`; leave `cr69a_feedbackcontent`
   unmapped.
2. In **Create Edit Requests**, map query output
   `requester_feedback_dataverse_format` to the existing Edit Request field that
   previously received `cr69a_feedbackcontent`.
3. In **Create GRB Activity Logs**, map `new_recommendationsforthegrb` to the
   same-named Activity Log field. The query now reads the replacement staging
   field, with the old field retained only as a compatibility fallback.
4. Refresh both downstream dataflows and verify representative `REQUESTER` and
   `GRB` feedback rows retain their complete text.

## Estimated Lifecycle Costs

The EASI `estimated_lifecycle_costs` rows are migrated into fiscal-year cost
fields on Business Case Solution records. The old EASI shape has one row per
business case, solution, phase, and year; the Power Platform shape stores one
currency value per solution fiscal year. Migration therefore sums all phases for
the same business case, solution, and fiscal year.

Costs are treated as dollar values, not cents. The FY target fields are
Dataverse currency fields, so grouped values must stay within Dataverse's money
range of +/- 922,337,203,685,477. The `06-create-estimated-lifecycle-costs.m`
dataflow exposes `InvalidSourceRows` for blank or invalid business case IDs,
solutions, years, and costs. It also exposes `InvalidCostRows` for grouped FY
costs outside the Dataverse currency range. The final update query fails when
either query contains rows. Do not write to `new_systemtotalcost`; it is a
calculated field.

TODO
Review Data Migration - move required data from intake requests to Reviews.

## CEDAR systems dev data

The dev migration data includes a CEDAR systems export at `easi-dev-data/cedar_systems.json`.
This file represents the system records used by intake migration data when a real CEDAR
connection is not available in dev.

CEDAR JSON exports may include copied timestamp fragments in keys or values, UUID spacing
issues, or GUID values wrapped in extra curly braces. Clean new exports before committing
or using them for migration work:

```bash
npm run cedar:clean -- apps/it-governance/migrations/easi-dev-data/cedar_systems.json --dry-run --verbose
npm run cedar:clean -- apps/it-governance/migrations/easi-dev-data/cedar_systems.json --in-place
```

Use `--dry-run --verbose` first to review the changes. The in-place command rewrites the
JSON file after removing supported export artifacts.

## Linked system CSV cleanup

The `system_intake_systems.csv` export may mix braced and unbraced values in the
`system_id` column. Normalize that column before uploading the CSV for migration work.
The cleanup only changes `system_id`; relationship values such as `{PRIMARY_SUPPORT,OTHER}`
are left as-is.

```bash
npm run intake:systems:clean -- --dry-run --verbose
npm run intake:systems:clean -- --in-place
```

The command defaults to `easi-dev-data/system_intake_systems.csv`. Pass one or more paths
to reuse it for UAT or prod exports:

```bash
npm run intake:systems:clean -- path/to/system_intake_systems.csv --dry-run --verbose
```

EASI Postgresql Table Data Source Inventory

business_cases
estimated_lifecycle_costs
feedback_valid_source_target_combinatiions (doesn't seem neccessary)
governance_request_feedback
system_intake_contacts
system_intake_contacts_legacy
system_intake_contract_numbers
system_intake_documents
system_intake_funding_sources
system_intake_grb_presentation_links
system_intake_grb_reviewers
system_intake_internal_grb_review_discussion_posts
system_intake_systems
system_intakes
