#!/usr/bin/env node

import { existsSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import {
  cloneSolution,
  findPac,
  getDirectoryChanges,
  getWorkingTreeChanges,
  loadSolutionConfig,
  requirePacVersion,
} from "./pac-solution-common.mjs";

async function main() {
  const repoRoot = process.cwd();
  const { environmentUrl, solutionName, outputFolder } = loadSolutionConfig(repoRoot);
  const pac = findPac();
  if (!pac) throw new Error("PAC CLI was not found. Install Microsoft.PowerApps.CLI.Tool before exporting.");
  requirePacVersion(pac);

  const localChanges = getWorkingTreeChanges(repoRoot, outputFolder);
  if (localChanges) {
    throw new Error(
      `The solution folder has uncommitted or untracked changes. Commit, stash, or remove them before exporting:\n${localChanges}`,
    );
  }

  const parentFolder = path.dirname(outputFolder);
  const stagingRoot = mkdtempSync(path.join(parentFolder, ".pac-export-"));
  const unpackedFolder = path.join(stagingRoot, "unpacked");
  const previousFolder = path.join(stagingRoot, "previous");

  try {
    console.log(`Exporting '${solutionName}' from ${environmentUrl}`);
    cloneSolution({ pac, environmentUrl, solutionName, outputFolder: unpackedFolder });

    if (existsSync(outputFolder)) {
      const changes = getDirectoryChanges(outputFolder, unpackedFolder);
      if (!changes) {
        console.log("The checked-out solution already matches the environment. No files changed.");
        return;
      }
      console.log("\nIncoming solution changes:\n");
      console.log(changes);
    } else {
      console.log(`\nThis is the initial export to ${path.relative(repoRoot, outputFolder)}.`);
    }

    if (!(await confirm("\nReplace the checked-out solution with this export? (y/N) "))) {
      console.log("Export cancelled. The checked-out solution was not changed.");
      return;
    }

    if (existsSync(outputFolder)) renameSync(outputFolder, previousFolder);
    try {
      renameSync(unpackedFolder, outputFolder);
    } catch (error) {
      if (existsSync(previousFolder)) renameSync(previousFolder, outputFolder);
      throw error;
    }

    console.log(`Solution updated at ${path.relative(repoRoot, outputFolder)}.`);
    console.log("Review the complete Git diff before staging or committing it.");
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

async function confirm(prompt) {
  if (!process.stdin.isTTY) return false;
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await readline.question(prompt)).trim());
  } finally {
    readline.close();
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
