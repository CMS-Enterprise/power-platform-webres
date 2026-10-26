# Migration Process Improvements

This backlog captures improvements identified while configuring and validating
the IT Governance migration in UAT. The goal is a repeatable, evidence-backed
workflow for deployment, rehearsal, reconciliation, and rollback.

## Immediate

- [ ] Add a consistent **Require Running Migration** guard to every migration
  dataflow before it can produce destination rows.
  - Fail when there is no Running Migration Run.
  - Fail when more than one Migration Run is marked Running instead of silently
    choosing the newest one.
  - Use the validated run's batch ID on every created or updated row.
  - Ensure the guard is referenced by the loaded output so Power Query cannot
    skip its evaluation.
  - Verify configuring or publishing a migration dataflow with no Running
    Migration Run cannot write destination data.
- [ ] Make historical GRB Activity Log row-level QA nonblocking: retain
  `FeedbackTypeQA` and `HistoricalGrbActivityLogQA`, load only rows whose
  `UnmappedIssues` is null, and reserve hard failures for structural problems
  such as missing required columns.
- [ ] Resolve the UAT `system_intakes.csv` text-length mismatches, then compare
  the same source values with the destination System Intake column limits.
  - The 2026-10-22 staging audit checked 1,036 source records and 68 mapped text
    columns using UTF-16 code-unit lengths. It found 105 over-limit values
    across 55 records and seven staging columns. Each affected staging column
    currently has a 100-character limit:

    | Source column | Intake Staging column | Maximum observed | Failing records |
    | --- | --- | ---: | ---: |
    | `business_need` | `cr69a_business_need` | 2,000 | 39 |
    | `solution` | `cr69a_solution` | 2,000 | 36 |
    | `lcid_scope` | `cr69a_lcid_scope` | 2,342 | 14 |
    | `decision_next_steps` | `cr69a_decision_next_steps` | 2,342 | 13 |
    | `lcid_cost_baseline` | `cr69a_lcid_cost_baseline` | 445 | 1 |
    | `grt_review_email_body` | `cr69a_grt_review_email_body` | 146 | 1 |
    | `project_name` | `cr69a_project_name` | 226 | 1 |

  - `project_acronym` had no over-limit values in this file, indicating the
    previously identified acronym correction is present.
  - The 226-character `project_name` is an `@WEBSERVICE(CHAR(...))` formula-
    injection test value and also appears in `business_need` on the same row.
    Quarantine or reject that unsafe record rather than silently migrating it.
  - Widen legitimate narrative staging fields so staging preserves their source
    values. Apply explicit destination truncation or rejection policies with QA
    warnings instead of allowing Dataverse writes to fail unexpectedly.
- [x] Confirm `new_activitylogses` is covered by **Intake - Rollback Migration
  Data** using `cr3ee_batchid`. The live flow already lists and deletes matching
  Activity Logs by `new_activitylogsid`.
- [ ] Confirm every migration output table is batch-stamped and covered by a
  rollback action.
- [ ] Run the full UAT sequence: preflight, staging, staging reconciliation,
  migration, destination reconciliation, rollback, and rollback reconciliation.
- [ ] Compare post-rollback UAT counts with
  [`run-baselines/uat-2026-10-21T205408Z.json`](./run-baselines/uat-2026-10-21T205408Z.json).
- [ ] Confirm both UAT orchestration flows are enabled and use only their split
  staging or migration dataflow configuration environment variable.

## Automate the checks

- [ ] Add `npm run migration:preflight -- --environment <name>`.
  - Confirm the target environment explicitly.
  - Confirm exactly one intended Migration Run is active.
  - Reject duplicate dataflow display names.
  - Confirm every configured Power Automate dataflow ID resolves to one live
    dataflow.
  - Validate environment IDs, Dataverse URLs, SharePoint paths, environment
    variables, flow states, and connection references.
  - Confirm validation and execution consume the same configuration variables.
- [ ] Add `npm run migration:snapshot -- --environment <name>` to capture total
  and batch-stamped counts for staging and destination tables.
- [ ] Add `npm run migration:reconcile -- --environment <name> --batch <id>` to
  compare source, staging, and destination counts and report missing, duplicate,
  rejected, or orphaned records.
- [ ] Add `npm run migration:rollback-check -- --environment <name> --batch <id>`
  to compare the environment with its pre-run baseline and flag residual rows.
- [ ] Add a static coverage check that compares dataflow destination tables with
  tables handled by both rollback flows.
- [ ] Add a static check that every migration dataflow implements the shared
  Running Migration guard and batch-stamping contract.

## Deployment inventory

- [ ] Generate one environment inventory report containing:
  - Solution versions and import mode.
  - Dataflow names, Dataverse record IDs, and Power Automate refresh IDs.
  - Duplicate-name and stale-ID findings.
  - Environment-variable definitions, current-value status, and referenced
    environment IDs.
  - Cloud-flow enabled states and environment-variable dependencies.
  - Connection-reference owners and connection status.
  - Expected Dataverse and SharePoint endpoints.
  - Migration and rollback entity coverage.
- [ ] Run the inventory before and after every migration-solution deployment and
  fail on unexplained drift.
- [ ] Automate post-deployment dataflow configuration and publishing, then
  regenerate the split staging and migration environment-variable JSON from
  the newly installed Power Automate refresh IDs.
- [ ] Teach the inventory to distinguish Power Platform's paired internal
  `msdyn_dataflows` records from true user-visible duplicate dataflows, while
  still flagging stale old-path records and ambiguous ID selection.
- [ ] Preserve pre-staging, post-staging, post-migration, and post-rollback
  snapshots as run artifacts identified by environment and batch ID.

## Safety and operability

- [ ] Require an explicit environment confirmation before any command that can
  refresh dataflows, create records, delete records, or modify solutions.
- [ ] Keep diagnostic and inventory commands read-only by default.
- [ ] Add a production gate that rejects empty IDs, unresolved IDs, duplicate
  names, inactive required flows, or unexpected source paths.
- [ ] Document the approved owner/service account for every connection
  reference and dataflow.
- [ ] Produce a concise rehearsal/cutover report with counts, failures, known
  exclusions, rollback results, and go/no-go evidence.

## Agent tooling

- [ ] Package the repository-specific migration workflow as a Codex skill or
  equivalent checked-in agent guidance so future sessions follow the same
  environment routing, safety gates, and reconciliation process.
- [ ] Re-evaluate Microsoft's
  [`power-platform-skills`](https://github.com/microsoft/power-platform-skills)
  Power Automate plugin after it supports GCC High/sovereign Power Platform
  endpoints and reliably edits solution-aware flows with connection references.
- [ ] Evaluate the Microsoft Dataverse skills in a read-only sandbox before
  adopting them for deployment or mutation workflows.
- [ ] Do not use a remote `curl | node` installer in the project workflow;
  review and pin any adopted tooling to a known version.
