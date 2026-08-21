# IT Governance Data Migration Plan

**Last updated:** August 21, 2026  
**Status:** Pre-production planning and validation

## Overview

This plan describes how IT Governance data will be migrated from the legacy EASi PostgreSQL database and the CEDAR API into the CMS IT Governance Power App and Dataverse environment.

Power Platform dataflows perform staging, transformation, record creation, and relationship linking. Power Automate orchestration flows run the dataflows in dependency order. The migration includes the data required to support the IT Governance application in production. Detailed table mappings, field transformations, and exclusions are maintained in the [IT Governance Intake Request Mapping Workbook](https://docs.google.com/spreadsheets/d/1-TfJrVtfF5lW-SKITZK1plbBq_KQsQMUslB9jk5Pwbo/edit?gid=0#gid=0).

## Deliverables

- Migration dataflows and orchestration flows deployed to the required environments
- Current data mapping workbook
- Staged-data and migrated-data validation views or dashboards
- Batch-based rollback flows
- Rehearsal results, exception reports, and production reconciliation evidence
- An approved production cutover and rollback runbook

## Success Criteria

- All in-scope source records are preserved and accounted for.
- Required records, relationships, choice values, and ownership are migrated correctly.
- No unexpected truncation, coercion, or silent data loss occurs.
- Dataflow QA queries contain no unresolved blocking issues.
- Source, staging, and destination reconciliation checks pass.
- Representative application workflows pass a post-migration smoke test.
- The migration can be rerun or rolled back by batch without affecting unrelated records.
- Business and technical owners approve the production migration results.

## Scope and Mapping

The mapping workbook is the authoritative record of source-to-target mappings, transformations, and exclusions. Important conversion rules include:

- PostgreSQL enums are mapped to Dataverse choices.
- Unsupported source types, including `bigint` where applicable, are converted to compatible Dataverse number types after range validation.
- NULL values, booleans, dates, and numbers are normalized to Power Platform conventions.
- Text-column lengths must be validated before cutover because Dataverse or dataflow loading may truncate or reject oversized values.
- Multi-select values are parsed and checked for partially mapped or unknown values.
- Estimated lifecycle costs are grouped by business case, solution, and fiscal year, with phase values summed into Dataverse currency fields.

Any change to a dataflow mapping must be reflected in the mapping workbook and revalidated in a lower environment.

## Environment Readiness

The migration is designed to run in Development, UAT, and Production. Dataflow definitions in this repository are snapshots of the current Dataverse definitions; deployment and publishing still occur through Power Platform.

### Development

- Development dataflows currently use development seed exports.
- Source-controlled M snapshots and a manifest are available under `apps/it-governance/migrations/dataflows`.
- Local commands can list, pull, and compare the tracked dataflows with Dataverse.
- Before the next rehearsal, confirm the orchestration flows and all manifest dataflows are published and aligned with the intended Development environment.

### UAT

The current UAT deployment and publishing state must be reconfirmed in Power Platform. Before UAT rehearsal:

- Confirm every required dataflow and orchestration flow is deployed, configured, and published.
- Update and test the UAT SharePoint and Dataverse connections.
- Confirm the service account owns the flows, connections, and migrated records where required.
- Run the full staging, migration, validation, and rollback sequence.
- Record reconciliation results, exceptions, duration, and remediation items.

### Production

Production source exports will be acquired immediately before the approved cutover window. Before production execution:

- Confirm all dataflows and orchestration flows are deployed, configured, published, and owned by approved service accounts.
- Set and verify the production Dataverse URL, SharePoint site, folder path, and connection references in Power Platform.
- Confirm the approved shared SharePoint migration location has appropriate access controls, retention, and cleanup procedures.
- Validate production access for Oddball contractors, on-premises CMS users, and remote CMS users on GFE devices.
- Determine whether VPN access is required only for administration and migration or for normal application runtime use.
- Complete at least one production-like rehearsal and obtain cutover approval.

## Migration Process

### 1. Prepare and Preserve Source Data

At an agreed low-usage time, the IT Governance and DIIMP teams will export the in-scope EASi PostgreSQL tables to CSV. Preserve an immutable copy of the source exports before cleanup or transformation, then place the working copies in the approved CMS SharePoint migration location.

CEDAR systems are exported separately as JSON through the EASi application and CEDAR API. Clean supported export artifacts before staging:

```bash
npm run cedar:clean -- path/to/cedar_systems.json --dry-run --verbose
npm run cedar:clean -- path/to/cedar_systems.json --in-place
```

Normalize mixed braced and unbraced values in the linked-system `system_id` column before upload:

```bash
npm run intake:systems:clean -- path/to/system_intake_systems.csv --dry-run --verbose
npm run intake:systems:clean -- path/to/system_intake_systems.csv --in-place
```

Review the dry-run output before changing either file.

### 2. Start a Migration Batch

Create or start a migration-run record and record its Batch ID. Dataflows use the latest running migration to stamp staged and migrated records. Only one intended migration batch should be in a running state during execution.

### 3. Stage Source Data

Run **Intake - Stage All Data**. The orchestration flow loads the SharePoint CSV and JSON files into Dataverse staging tables.

After staging:

- Review every staging dataflow run for errors or rejected rows.
- Review QA and exception queries.
- Compare source-file and staging-table counts by record type and meaningful status.
- Confirm every staged record contains the expected Batch ID.
- Retain the original source values needed to trace later transformations.

Do not proceed while unexplained staging discrepancies remain.

### 4. Create and Link Dataverse Records

Run **Intake - Migrate All Data**. The orchestration must preserve dependency order. The current migration includes jobs for:

- LCIDs
- CEDAR systems
- Requests
- Reviews and Request-to-Review links
- Funding sources and LCID links
- Additional contacts
- Business cases, solutions, and estimated lifecycle costs
- Documents
- Edit requests
- Linked systems
- Contract numbers
- Request multi-select updates

After migration, review each dataflow run, its QA output, unresolved lookups, and affected-row counts. Do not rely on a single grand total; reconcile each entity and relationship separately.

### 5. Validate

Validation must include:

- **Source preservation:** Confirm immutable exports match what came from EASi and CEDAR.
- **Mapping QA:** Resolve unknown choices, invalid dates, invalid state combinations, oversized text, unsafe numeric values, and partially mapped multi-selects.
- **Relationship checks:** Identify orphaned Reviews, LCIDs, CEDAR systems, contacts, documents, business cases, and other child records.
- **Business-rule reconciliation:** Check active versus finished requests, reopened decisions, requests without decisions, and other agreed edge cases.
- **Golden records:** Trace representative simple, complex, active, completed, and edge-case records across all important fields and relationships.
- **Ownership and security:** Verify migrated-record ownership, team access, security roles, and service-account behavior.
- **Application smoke test:** Verify key views, dashboards, navigation, forms, plugins, and representative workflows.
- **Access-path test:** Verify connectivity for contractors and CMS users from each supported network/device scenario, including remote GFE access.

Exceptions must be captured in a reviewable list with an owner and disposition; they must not be silently discarded.

### 6. Approve or Roll Back

If validation succeeds, record business and technical approval for the batch. If rollback is required:

1. Stop user activity and any dependent automation that could modify migrated records.
2. Record the failed Batch ID and preserve run history and validation evidence.
3. Run **Intake - Rollback Migration Data** for that Batch ID.
4. Run **Intake - Rollback Staged Migration Data** as required.
5. Confirm that records from other batches and manually created records were not affected.
6. Resolve the cause and repeat the full rehearsal before another production attempt.

Rollback behavior and entity coverage must be proven in UAT before production cutover.

## Migration Rehearsals

At least one complete lower-environment rehearsal should validate:

- Source acquisition and file cleanup
- Environment parameters and connections
- Transformations, choices, lookups, and multi-select mappings
- Service-account ownership and security
- Entity- and relationship-level reconciliation
- Batch isolation, idempotent reruns, and rollback coverage
- End-to-end duration and operational staffing
- Application smoke tests and supported user access paths

If production is not yet in use, a controlled production rehearsal may be considered with explicit approval and a tested cleanup procedure.

## Cutover Plan

The IT Governance and DIIMP teams must approve a detailed runbook before production migration. It must identify:

- Cutover date, freeze window, and expected duration
- Named business and technical decision-makers
- Source export owner and final extraction procedure
- Migration operator and service accounts
- Validation owners and acceptance deadline
- Go/no-go criteria and rollback decision authority
- User communications and support escalation path
- EASi disposition, including any read-only or parallel-operation period
- Post-cutover monitoring and source-file retention/cleanup

## Risks and Open Decisions

| Item | Required decision or mitigation |
| --- | --- |
| Environment state | Reconfirm which UAT and Production flows/dataflows are deployed, published, connected, and current. |
| Network and VPN access | Determine the production access design and test all supported user populations. Avoid relying on an untested per-user VPN model at scale. |
| SharePoint governance | Confirm the shared CMS migration location, permissions, retention, auditability, and cleanup owner. |
| EASi transition | Decide whether EASi will be decommissioned, made read-only, or operated in parallel. |
| Parallel operation | If required, define the system of record and a process that prevents or reconciles data divergence. |
| Cutover ownership | Name the people authorized to approve go-live and invoke rollback. |
| Rollback completeness | Verify every migrated entity is batch-stamped and covered by rollback, including relationships and follow-up updates. |
| Dataflow drift | Compare checked-in snapshots with Dataverse before each rehearsal and cutover. |
| Source changes | Define how late EASi changes during the freeze/export window will be prevented or captured. |

## Supporting References

- [IT Governance Intake Request Mapping Workbook](https://docs.google.com/spreadsheets/d/1-TfJrVtfF5lW-SKITZK1plbBq_KQsQMUslB9jk5Pwbo/edit?gid=0#gid=0)
- [CEDAR Systems List - Data Migration Guide](https://docs.google.com/document/d/1lIPpWi4raIHQ0JIHbIwNiY8WGi90JVNmrwc2naiSwEI/edit?usp=sharing)
- Repository migration guide: `apps/it-governance/migrations/README.md`

