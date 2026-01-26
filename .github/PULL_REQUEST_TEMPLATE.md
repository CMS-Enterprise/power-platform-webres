<!--
REQUIRED
- PR title must include relevant Jira ticket(s) if applicable.
  Pattern: [EASI-1234] Title of PR
  Use [NOREF] if no ticket exists.
- If the change impacts a Dataverse Solution, name it explicitly below.
-->

# EASI-0000

## Power Platform scope

**App / Solution:** <!-- e.g., IT Governance / ITGovCore -->
**Environment(s) impacted:** <!-- Dev / Test / UAT / Prod -->
**Change type (check all that apply):**

- [ ] Model-driven app (forms/views/commands)
- [ ] Web resources (JS/HTML/CSS/images)
- [ ] Dataverse schema (tables/columns/relationships/choices)
- [ ] Business logic (Business Rules / Power Automate / Workflows)
- [ ] Plugins (C# / registered steps)
- [ ] Data migration (dataflows / M scripts / scripts)
- [ ] Security (roles/teams/field security)
- [ ] Integrations (connections / connectors / DLP)
- [ ] Other: <!-- -->

## Description

<!--
REQUIRED
Explain what this PR accomplishes and why.
If this is tied to a user story, include expected behavior.
Include screenshots/screen recordings for UI changes when possible.
-->

## What changed

<!--
REQUIRED
List key changes with paths.
Examples:
- Updated form wizard logic: apps/it-governance/webresources/js/itgov_formWizard.js
- Added new web resource: apps/it-governance/webresources/html/progress_tracker.html
- Updated plugin: plugins/ItGov.Plugins/CreateAdditionalContactOnRequestCreate.cs
- Updated dataflow query: dataflows/itgov/business_cases.pq
-->

## Deployment notes

<!--
REQUIRED
How does this get into the environment?
Be explicit so someone else can deploy it.
-->

- **Delivery mechanism:** <!-- Solution import / PAC CLI / Plugin Registration Tool / Manual config -->
- **Solution name + version:** <!-- if applicable -->
- **Manual steps required:** <!-- ideally "none" -->
- **Secrets / connections / DLP needed:** <!-- name the connector/policy -->
- **Rollback plan:** <!-- e.g., re-import previous managed solution, revert plugin assembly, etc. -->

## How to test this change

<!--
REQUIRED
Testing in Power Apps is environment-based. Provide exact steps.
Include record URLs if helpful (Dev only).
-->

1.
2.
3.

### Verified in environment(s)

- [ ] Dev

## Risk / impact

<!--
REQUIRED
Call out anything that could break: schema changes, required fields, plugins, data migrations, security.
-->

- **Data impact:** <!-- none / schema / migration -->
- **Backward compatibility:** <!-- safe / requires solution upgrade -->
- **Performance considerations:** <!-- plugin sync, large queries, etc. -->

## PR Author Checklist

- [ ] I described what changed and why.
- [ ] I included clear test steps and validated in at least one environment.
- [ ] I updated documentation/README if this changes how we deploy or develop.
- [ ] If schema changed, I noted the Solution + components affected.
- [ ] If plugin changed, I noted the message/step/stage and confirmed it runs as expected.
- [ ] If data migration/dataflow changed, I tested with representative data.
- [ ] No secrets, tokens, or environment-specific IDs were committed.

## PR Reviewer Guidelines

- Prefer pulling the branch and validating in the listed environment(s), not only reading code.
- When approving, state why (tested in Dev, reviewed deployment notes, etc.).
- For platform changes: verify solution/deploy steps are clear and complete.
- For plugins: sanity-check registration details (Message, Stage, Filtering Attributes, Secure/Unsecure config).
