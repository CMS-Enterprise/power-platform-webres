#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();

  for (const resource of args.resources) {
    const localPath = path.resolve(
      repoRoot,
      "apps/it-governance/web-resources",
      normalizeRelativePath(resource)
    );
    const remotePath = buildSnapshotPath(localPath);

    if (!existsSync(localPath)) {
      throw new Error(`Local file not found: ${path.relative(repoRoot, localPath)}`);
    }

    if (!existsSync(remotePath)) {
      throw new Error(
        `Remote snapshot not found for ${resource}. Run 'npm run webres:pull:file -- ${resource}' first.`
      );
    }

    console.log(`Diffing ${resource}`);
    console.log(`local:  ${path.relative(repoRoot, localPath)}`);
    console.log(`remote: ${path.relative(repoRoot, remotePath)}`);
    console.log("");

    const result = runDiff(remotePath, localPath);

    if (result.status === 0) {
      console.log("No differences.");
    } else if (result.status !== 1) {
      process.exitCode = result.status ?? 1;
    }

    console.log("");
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
    throw new Error("Provide at least one resource path to diff.");
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/diff-webresource-snapshot.mjs html/example.html
  node ./scripts/diff-webresource-snapshot.mjs --resource html/example.html

Behavior:
  Compares the local file to its sibling .remote snapshot using diff -u,
  or git diff --no-index when diff is unavailable.
  If the .remote snapshot does not exist yet, pull it first:
  npm run webres:pull:file -- html/example.html
`);
}

function runDiff(remotePath, localPath) {
  const commands = [
    {
      command: "diff",
      args: ["-u", remotePath, localPath]
    },
    {
      command: "git",
      args: ["diff", "--no-index", "--no-ext-diff", "--", remotePath, localPath]
    }
  ];

  const failures = [];

  for (const candidate of commands) {
    const result = spawnSync(candidate.command, candidate.args, {
      stdio: "inherit"
    });

    if (!result.error) {
      return result;
    }

    if (result.error.code === "ENOENT") {
      failures.push(candidate.command);
      continue;
    }

    throw result.error;
  }

  throw new Error(
    `No supported diff tool was found. Tried: ${failures.join(", ")}. ` +
      "Install a Unix-style diff tool or Git and ensure it is available on PATH."
  );
}

function buildSnapshotPath(absolutePath) {
  const extension = path.extname(absolutePath);
  const base = absolutePath.slice(0, absolutePath.length - extension.length);
  return `${base}.remote${extension}`;
}

function normalizeRelativePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.?\//, "");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
