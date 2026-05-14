#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  for (const resource of args.resources) {
    console.log(`Publishing local file with --force: ${resource}`);
    const result = spawnSync(
      "node",
      ["./scripts/deploy-webresources.mjs", resource, "--force"],
      { cwd: process.cwd(), stdio: "inherit" }
    );

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }
  }
}

function parseArgs(argv) {
  const args = {
    resources: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--resource") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--resource requires a relative file path.");
      }
      args.resources.push(normalizeRelativePath(value));
      index += 1;
      continue;
    }

    if (current === "--help" || current === "-h") {
      printHelp();
      process.exit(0);
    }

    if (!current.startsWith("-")) {
      args.resources.push(normalizeRelativePath(current));
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  if (args.resources.length === 0) {
    throw new Error("Provide at least one resource path.");
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/use-local-webresource-file.mjs html/example.html
  node ./scripts/use-local-webresource-file.mjs --resource html/example.html

Behavior:
  Publishes the local file using the deploy script with --force.
  Use this only after reviewing the difference and intentionally choosing local over Dataverse.
`);
}

function normalizeRelativePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.?\//, "");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
