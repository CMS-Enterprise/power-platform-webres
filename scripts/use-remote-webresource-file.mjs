#!/usr/bin/env node

import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

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

    if (!existsSync(remotePath)) {
      throw new Error(
        `Remote snapshot not found for ${resource}. Run 'npm run webres:pull:file -- ${resource}' first.`
      );
    }

    await mkdir(path.dirname(localPath), { recursive: true });
    await copyFile(remotePath, localPath);

    console.log(`Replaced local file from remote snapshot: ${resource}`);
    console.log(`local:  ${path.relative(repoRoot, localPath)}`);
    console.log(`remote: ${path.relative(repoRoot, remotePath)}`);
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
    throw new Error("Provide at least one resource path.");
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/use-remote-webresource-file.mjs html/example.html
  node ./scripts/use-remote-webresource-file.mjs --resource html/example.html

Behavior:
  Replaces the local file with its sibling .remote snapshot.
  Pull the snapshot first if needed:
  npm run webres:pull:file -- html/example.html
`);
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
