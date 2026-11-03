# Migration Process Improvements

This backlog is intentionally limited to work that makes the IT Governance
migration safer for UAT and production. Complete the UAT blockers before adding
more migration tooling.

## UAT blockers

- [ ] Resolve the UAT `system_intakes.csv` text-length mismatches and compare
  the affected source values with the destination System Intake column limits.
  - The 2026-10-22 audit checked 1,036 records and found 105 over-limit values
    across 55 records and seven staging columns:

    | Source column | Intake Staging column | Maximum observed | Failing records |
    | --- | --- | ---: | ---: |
    | `business_need` | `cr69a_business_need` | 2,000 | 39 |
    | `solution` | `cr69a_solution` | 2,000 | 36 |
    | `lcid_scope` | `cr69a_lcid_scope` | 2,342 | 14 |
    | `decision_next_steps` | `cr69a_decision_next_steps` | 2,342 | 13 |
    | `lcid_cost_baseline` | `cr69a_lcid_cost_baseline` | 445 | 1 |
    | `grt_review_email_body` | `cr69a_grt_review_email_body` | 146 | 1 |
    | `project_name` | `cr69a_project_name` | 226 | 1 |

  - Widen legitimate narrative staging fields so staging preserves source
    values. Apply an explicit destination truncation or rejection policy with
    QA warnings instead of allowing Dataverse writes to fail.
  - Quarantine or reject the 226-character `project_name` value containing an
    `@WEBSERVICE(CHAR(...))` formula-injection test instead of migrating it.
- [ ] Confirm every migration output table is batch-stamped and covered by the
  appropriate rollback flow.
- [ ] Confirm the UAT **Stage All Data** and **Migrate All Data** flows are
  enabled and each uses only its corresponding split dataflow-configuration
  environment variable.
- [ ] Verify in UAT that configuring, publishing, or refreshing every migration
  dataflow without exactly one **Migrating** Migration Run cannot write
  destination data. Local structural coverage is enforced by
  `npm run migration:guards:check` in PR CI.
- [ ] Run and record one complete UAT rehearsal:
  1. Preflight the target environment and active Migration Run.
  2. Stage and reconcile source-to-staging counts.
  3. Migrate and reconcile staging-to-destination counts.
  4. Roll back staged and destination data.
  5. Reconcile the post-rollback environment against
     [`run-baselines/uat-2026-10-21T205408Z.json`](./run-baselines/uat-2026-10-21T205408Z.json).
- [ ] Produce a concise UAT rehearsal report with counts, failures, known
  exclusions, rollback results, and go/no-go evidence.

## Post-UAT improvements

Prioritize these only when a manual UAT step proves error-prone or needs to be
repeated for production.

- [ ] Add a lightweight `npm run migration:preflight -- --environment <name>`
  that requires explicit target confirmation and checks configuration values,
  dataflow IDs, duplicate names, required flow states, and the intended
  Migration Run without modifying the environment.
- [ ] Add one migration reporting command that captures batch-stamped staging
  and destination counts, reports missing or duplicate records, and compares
  post-rollback state with a pre-run baseline.
- [ ] Add a static coverage check comparing migration destination tables with
  the tables handled by the rollback flows.
- [ ] Require explicit environment confirmation before any repository command
  that refreshes dataflows, creates or deletes records, or modifies solutions;
  keep diagnostic commands read-only by default.
- [ ] Document the approved owner or service account for production dataflows
  and connection references.
