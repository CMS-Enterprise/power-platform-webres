# Web Resource Deployment

This repo now includes a lightweight deploy scaffold for Dataverse web resources.

The goal is to replace the manual loop of:

1. Edit a local file
2. Copy/paste content into the browser
3. Click save
4. Click publish

with:

1. Edit a local file
2. Run one command

This script deploys Dataverse web resources directly via the Web API (no browser interaction required).

## What the scaffold does

The deploy script:

- Reads local files from `apps/it-governance/web-resources`
- Maps them to Dataverse web resource names using a manifest
- Authenticates with a service principal using OAuth client credentials
- Creates missing web resources directly in a specific unmanaged solution
- Updates existing web resources in place
- Publishes only the web resources touched by the run
- Does not delete existing web resources
- Only updates files defined in the manifest

## Files

- `.env.example`
  - Environment-specific secrets and URLs
- `apps/it-governance/web-resources/webresources.manifest.json`
  - Local path to Dataverse name mapping
- `scripts/deploy-webresources.mjs`
  - Deployment CLI
- `scripts/check-webresources.mjs`
  - Compare local files to Dataverse without changing either side
- `scripts/pull-webresource-snapshot.mjs`
  - Save the Dataverse version beside a local file as a safe review snapshot
- `scripts/webresources-help.mjs`
  - Quick command index for the web resource workflow

## Setup

### Prerequisite: Node.js

This workflow requires Node.js installed locally because the deploy scripts run with `node`.

- Recommended: Node.js 18 or newer
- Verified in this repo with Node.js 20

Check whether Node is already installed:

```bash
node -v
```

If `node` is not installed, install Node.js first, then return to the steps below.

There is currently no `npm install` step for this repo because the deploy scripts only use built-in Node features and do not depend on external npm packages.

1. Copy `.env.example` to `.env`
2. Fill in:
   - `TENANT_ID`
   - `CLIENT_ID`
   - `CLIENT_SECRET`
   - `DATAVERSE_URL`
   - `DATAVERSE_SOLUTION_UNIQUE_NAME`
3. Update `nameTemplate` in `apps/it-governance/web-resources/webresources.manifest.json`

Example:

```json
{
  "nameTemplate": "new_itgov/{relativePath}"
}
```

If a historical web resource name does not follow that pattern, set a `name` on that specific entry:

```json
{
  "file": "js/commonJSLibrary.js",
  "name": "new_commonJSLibrary.js"
}
```

## Commands

Show the command summary:

```bash
npm run webres:help
```

Sync new local files into the manifest:

```bash
npm run webres:manifest:sync
```

Preview missing files only:

```bash
node ./scripts/sync-webresources-manifest.mjs \
  --manifest ./apps/it-governance/web-resources/webresources.manifest.json \
  --dry-run
```

Sync and prefill suggested Dataverse names from `nameTemplate`:

```bash
node ./scripts/sync-webresources-manifest.mjs \
  --manifest ./apps/it-governance/web-resources/webresources.manifest.json \
  --with-names
```

Check whether local files match Dataverse before publishing:

```bash
npm run webres:check
```

Check one file only:

```bash
npm run webres:check:file -- js/commonJSLibrary.js
```

Clean up all `.remote` snapshot files after a confirmation prompt:

```bash
npm run webres:clean:snapshots
```

Pull a remote snapshot for one file without overwriting the local source:

```bash
npm run webres:pull:file -- js/commonJSLibrary.js
```

Pull a remote snapshot and immediately diff it against local:

```bash
npm run webres:review:file -- js/commonJSLibrary.js
```

Choose local after review and publish it over Dataverse:

```bash
npm run webres:use:local:file -- js/commonJSLibrary.js
```

Choose Dataverse after review and replace the local file from the pulled snapshot:

```bash
npm run webres:use:remote:file -- js/commonJSLibrary.js
```

Diff the local file against the pulled remote snapshot:

```bash
npm run webres:diff:file -- js/commonJSLibrary.js
```

Publish one file only:

```bash
npm run webres:publish:file -- js/commonJSLibrary.js
```

Force a publish after reviewing and intentionally choosing to overwrite Dataverse:

```bash
node ./scripts/deploy-webresources.mjs js/commonJSLibrary.js --force
```

Preview one file only:

```bash
npm run webres:plan:file -- js/commonJSLibrary.js
```

## Why Node instead of raw curl

Yes, this can be done with `curl`, because the Dataverse Web API is just HTTP.

The annoying parts are:

- Getting the OAuth token
- Base64-encoding file content
- Escaping OData filters
- Sending `MSCRM.SolutionUniqueName`
- Building the `PublishXml` payload
- Handling create-vs-update logic

This scaffold keeps the process dependency-light while using the Dataverse Web API directly. It uses Node's built-in `fetch` and does not require any npm packages.

## Manifest sync behavior

The manifest sync helper:

- Scans `apps/it-governance/web-resources` for supported web resource file types
- Adds only files that are missing from the manifest
- Preserves existing entries and explicit `name` overrides
- Sorts manifest entries by `file` so the list stays tidy

If a local filename does not match the Power Platform web resource name, keep using an explicit `name` override in that manifest entry. The sync helper will not overwrite it.

## Check behavior

The check helper:

- Compares local file content to Dataverse web resource content using hashes
- Reports `IN_SYNC`, `DIFFERS`, or `REMOTE_MISSING`
- Shows local and remote modified timestamps when available
- Shows who last modified the Dataverse resource when available
- Exits with code `1` if any checked resource differs or is missing remotely

This is useful before publishing a single file.

## Publish safety behavior

The publish script now protects against accidental overwrite by default.

For existing web resources, it compares the currently published Dataverse content to the file's `git HEAD` version:

- If Dataverse matches `git HEAD`, publish is allowed
- If Dataverse already matches the current local file, publish is allowed
- If Dataverse differs from `git HEAD`, publish is blocked until you review the difference
- If a file is not available in `git HEAD` and Dataverse differs from local, publish is blocked until you review or force it

This means normal local edits do **not** require `--force`. The block only happens when Dataverse appears to have drifted from the version your branch was based on.

Recommended recovery flow when publish is blocked:

1. `npm run webres:check:file -- js/commonJSLibrary.js`
2. `npm run webres:pull:file -- js/commonJSLibrary.js`
3. `npm run webres:diff:file -- js/commonJSLibrary.js`
4. Decide whether to merge, choose local, or choose Dataverse
5. If local should win: `npm run webres:use:local:file -- js/commonJSLibrary.js`
6. If Dataverse should win: `npm run webres:use:remote:file -- js/commonJSLibrary.js`

## Remote snapshot behavior

The remote snapshot helper:

- Fetches the currently published Dataverse content for a mapped resource
- Writes it beside the local file using a `.remote` suffix such as `example.remote.html`
- Does not modify the local source file
- Helps you diff local work against the version currently published in Power Apps
- Remote snapshot files are ignored by git via `*.remote.*`
- Snapshot cleanup is available via `npm run webres:clean:snapshots`

Recommended review flow for a differing file:

1. `npm run webres:check:file -- js/commonJSLibrary.js`
2. `npm run webres:pull:file -- js/commonJSLibrary.js`
3. `npm run webres:diff:file -- js/commonJSLibrary.js`
4. Decide whether to merge, choose local, or choose Dataverse

## Solution behavior

For new web resources, the script sends the `MSCRM.SolutionUniqueName` header on create, which associates the new component with your chosen unmanaged solution.

For updates, the script also sends `MSCRM.SolutionUniqueName` on `PATCH`. That helps keep the deployment centered on one solution instead of treating solution membership as a separate manual step.

## First-run advice

The safest first run is:

1. Set `nameTemplate` to the prefix you think matches most existing web resource names
2. Run `npm run webres:plan:file -- html/example.html`
3. Fix any mismatched entries by adding explicit `name` values in the manifest
4. Run `npm run webres:publish:file -- html/example.html`

## Common Issues

- Authentication fails:
  - Check CLIENT_ID / CLIENT_SECRET / TENANT_ID
  - Ensure the service principal has access to the Dataverse environment

- Web resource not updating:
  - Confirm the manifest name matches the Dataverse web resource name
