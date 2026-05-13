#!/usr/bin/env node

import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const resourceRoot = path.resolve(repoRoot, "apps/it-governance/web-resources");
  const snapshotFiles = await listRemoteSnapshots(resourceRoot);

  if (snapshotFiles.length === 0) {
    console.log("No .remote snapshot files were found.");
    return;
  }

  console.log(`Found ${snapshotFiles.length} .remote snapshot file(s):`);
  for (const file of snapshotFiles) {
    console.log(`- ${path.relative(repoRoot, file)}`);
  }

  if (!args.yes) {
    const confirmed = await confirm(
      `This will delete all files with the .remote suffix listed above. Do you want to proceed? (y/N) `
    );
    if (!confirmed) {
      console.log("Canceled. No files were deleted.");
      return;
    }
  }

  for (const file of snapshotFiles) {
    await rm(file);
  }

  console.log(`Deleted ${snapshotFiles.length} .remote snapshot file(s).`);
}

function parseArgs(argv) {
  const args = {
    yes: false
  };

  for (const current of argv) {
    if (current === "--yes" || current === "-y") {
      args.yes = true;
      continue;
    }

    if (current === "--help" || current === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/clean-webresource-snapshots.mjs
  node ./scripts/clean-webresource-snapshots.mjs --yes

Options:
  --yes, -y   Delete all .remote snapshot files without prompting.
  --help      Show this help message.
`);
}

async function listRemoteSnapshots(root) {
  const results = [];
  await walk(root, results);
  return results.sort((left, right) => left.localeCompare(right));
}

async function walk(dir, results) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await walk(absolutePath, results);
      continue;
    }

    if (entry.isFile() && await isRemoteSnapshotFile(dir, entry.name)) {
      results.push(absolutePath);
    }
  }
}

async function isRemoteSnapshotFile(dir, fileName) {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);

  if (!extension || !baseName.endsWith(".remote")) {
    return false;
  }

  const sourceFileName = `${baseName.slice(0, -".remote".length)}${extension}`;
  if (!sourceFileName || sourceFileName === fileName) {
    return false;
  }

  const siblingEntries = await readdir(dir, { withFileTypes: true });
  return siblingEntries.some(
    (entry) => entry.isFile() && entry.name === sourceFileName
  );
}

async function confirm(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const answer = (await rl.question(promptText)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
