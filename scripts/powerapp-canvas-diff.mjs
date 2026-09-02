#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import {
  cloneSolution,
  findPac,
  getDirectoryChanges,
  loadSolutionConfig,
  requireCanvasPac,
  requirePacVersion,
  run,
} from "./pac-solution-common.mjs";

function unpackCanvasApps(
  canvasPac,
  repoRoot,
  solutionFolder,
  destinationRoot,
) {
  mkdirSync(destinationRoot, { recursive: true });
  for (const msappPath of findFiles(solutionFolder, ".msapp")) {
    const appName = path.basename(msappPath, ".msapp");
    run(
      canvasPac.command,
      [
        ...canvasPac.args,
        "canvas",
        "unpack",
        "--msapp",
        msappPath,
        "--sources",
        path.join(destinationRoot, appName),
      ],
      {
        cwd: repoRoot,
        errorMessage: `Could not unpack canvas app '${appName}' with repository-local PAC CLI ${canvasPac.version}.`,
      },
    );
  }
}

function findFiles(folder, extension) {
  if (!existsSync(folder)) return [];
  const matches = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const entryPath = path.join(folder, entry.name);
    if (entry.isDirectory()) matches.push(...findFiles(entryPath, extension));
    else if (entry.isFile() && entry.name.endsWith(extension))
      matches.push(entryPath);
  }
  return matches;
}

function printChanges(label, changes) {
  console.log(`\n${label}:`);
  console.log(changes || "No differences.");
}

function main() {
  const repoRoot = process.cwd();
  const { environmentUrl, solutionName, outputFolder } =
    loadSolutionConfig(repoRoot);
  if (!existsSync(outputFolder)) {
    throw new Error(
      `No checked-out solution exists at ${path.relative(repoRoot, outputFolder)}. Run npm run pac:export first.`,
    );
  }

  const pac = findPac();
  if (!pac)
    throw new Error(
      "PAC CLI was not found. Install Microsoft.PowerApps.CLI.Tool before comparing solutions.",
    );
  requirePacVersion(pac);
  const canvasPac = requireCanvasPac(repoRoot);

  const stagingRoot = mkdtempSync(path.join(tmpdir(), "pac-solution-diff-"));
  const remoteFolder = path.join(stagingRoot, "remote");
  const localCanvasFolder = path.join(stagingRoot, "local-canvas");
  const remoteCanvasFolder = path.join(stagingRoot, "remote-canvas");

  try {
    console.log(
      `Comparing the checked-out solution with '${solutionName}' in ${environmentUrl}`,
    );
    cloneSolution({
      pac,
      environmentUrl,
      solutionName,
      outputFolder: remoteFolder,
    });

    const solutionChanges = getDirectoryChanges(outputFolder, remoteFolder);
    printChanges("Solution file differences", solutionChanges);

    unpackCanvasApps(canvasPac, repoRoot, outputFolder, localCanvasFolder);
    unpackCanvasApps(canvasPac, repoRoot, remoteFolder, remoteCanvasFolder);
    const canvasChanges = getDirectoryChanges(
      localCanvasFolder,
      remoteCanvasFolder,
    );
    printChanges("Canvas app source differences", canvasChanges);

    if (solutionChanges || canvasChanges) process.exitCode = 1;
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
