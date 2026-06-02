# Data Migration Guide

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

`dataflows:check` verifies the pulled `./dataflows` files match Dataverse.

## Estimated Lifecycle Costs

The EASI `estimated_lifecycle_costs` rows are migrated into fiscal-year cost
fields on Business Case Solution records. The old EASI shape has one row per
business case, solution, phase, and year; the Power Platform shape stores one
currency value per solution fiscal year. Migration therefore sums all phases for
the same business case, solution, and fiscal year.

Costs are treated as dollar values, not cents. The FY target fields are
Dataverse currency fields, so grouped values must stay within Dataverse's money
range of +/- 922,337,203,685,477. The `06-create-estimated-lifecycle-costs.m`
dataflow exposes `InvalidCostRows` and fails the final update query if any FY
cost exceeds that limit. Do not write to `new_systemtotalcost`; it is a
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
