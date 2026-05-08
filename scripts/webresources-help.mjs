#!/usr/bin/env node

console.log(`Web resource commands

npm run webres:help
  Show this command summary.

npm run webres:manifest:sync
  Add any new local web resource files to the manifest.

npm run webres:check
  Compare the whole manifest against Dataverse and report differences.

npm run webres:check:file -- html/example.html
  Run a detailed single-file check with hashes and modified info.

npm run webres:clean:snapshots
  Delete all .remote snapshot files after a y/n confirmation prompt.

npm run webres:diff:file -- html/example.html
  Diff the local file against its html/example.remote.html snapshot.

npm run webres:pull:file -- html/example.html
  Write the Dataverse version beside the local file as html/example.remote.html.

npm run webres:review:file -- html/example.html
  Pull the Dataverse snapshot and immediately diff it against the local file.

npm run webres:use:local:file -- html/example.html
  Choose local and publish it with --force after review.

npm run webres:use:remote:file -- html/example.html
  Choose Dataverse and replace the local file from html/example.remote.html.

npm run webres:plan:file -- html/example.html
  Preview what publish would do for one file.

npm run webres:publish:file -- html/example.html
  Publish one file.

Publish with overwrite protection
  Publish now checks whether Dataverse matches the file's git HEAD version.
  If it does not, publish is blocked until you review the difference or rerun with --force.

Target one file
  node ./scripts/check-webresources.mjs html/example.html
  node ./scripts/deploy-webresources.mjs html/example.html --dry-run
  node ./scripts/deploy-webresources.mjs html/example.html

Per-script help
  node ./scripts/check-webresources.mjs --help
  node ./scripts/clean-webresource-snapshots.mjs --help
  node ./scripts/deploy-webresources.mjs --help
  node ./scripts/diff-webresource-snapshot.mjs --help
  node ./scripts/pull-webresource-snapshot.mjs --help
  node ./scripts/sync-webresources-manifest.mjs --help
  node ./scripts/use-local-webresource-file.mjs --help
  node ./scripts/use-remote-webresource-file.mjs --help
`);
