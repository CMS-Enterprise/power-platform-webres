// ============================================================
// powerapp-canvas-diff.mjs
// Compares the solution currently in the environment against the
// local unpacked copy, without modifying the local copy.
// Run with: node scripts/powerapp-canvas-diff.mjs
// ============================================================

import { execSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { basename, join } from "path";
import { createInterface } from "readline";

// ---- CONFIGURE THESE (keep in sync with export-solutions.mjs) ----
const ENVIRONMENT_URL = "https://itgovernancedev.crm9.dynamics.com"; // Your environment URL
const SOLUTION_NAME    = "InitialITGO";                              // Exact solution name (no spaces)
const OUTPUT_FOLDER    = `./${SOLUTION_NAME}`;                       // Local unpacked copy to diff against
const PACKAGE_TYPE     = "Unmanaged";                                // Unmanaged | Managed | Both
const CANVAS_APPS_DIR  = "CanvasApps";                                // Sub-folder holding .msapp files
// ---- END CONFIG ----


// ---- HELPERS ----
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;

function step(msg) { console.log(cyan(`\n>> ${msg}`)); }
function ok(msg)   { console.log(green(`   OK: ${msg}`)); }
function fail(msg) { console.error(red(`   ERROR: ${msg}`)); process.exit(1); }

// Resolve the pac executable — check PATH first, then the default .NET global tools location
function findPac() {
  try {
    execSync("pac help", { encoding: "utf8", stdio: "ignore" });
    return "pac";
  } catch {}

  const dotnetToolsPath = join(process.env.USERPROFILE ?? process.env.HOME, ".dotnet", "tools", "pac.exe");
  if (existsSync(dotnetToolsPath)) return `"${dotnetToolsPath}"`;

  return null;
}

// Solution/canvas diffs can easily exceed Node's default 1 MB exec buffer.
const EXEC_OPTS = { encoding: "utf8", stdio: ["inherit", "pipe", "pipe"], maxBuffer: 1024 * 1024 * 200 };

function run(cmd, errorMsg) {
  try {
    const output = execSync(cmd, EXEC_OPTS);
    if (output?.trim()) console.log("  ", output.trim());
    return output;
  } catch (err) {
    console.error(err.stderr || err.message);
    fail(errorMsg);
  }
}

// Unpacks every .msapp under canvasAppsDir into destRoot/<appname>/ so the
// Power Fx inside canvas apps becomes readable/diffable. destRoot is always
// created (even if empty) so the two sides can still be diffed later.
function unpackCanvasApps(pac, canvasAppsDir, destRoot, label) {
  mkdirSync(destRoot, { recursive: true });
  if (!existsSync(canvasAppsDir)) return;

  const msapps = readdirSync(canvasAppsDir).filter((f) => f.endsWith(".msapp"));
  if (msapps.length === 0) return;

  step(`Unpacking ${msapps.length} canvas app(s) from ${label}...`);
  for (const file of msapps) {
    const name = basename(file, ".msapp");
    run(
      `${pac} canvas unpack --msapp "${join(canvasAppsDir, file)}" --sources "${join(destRoot, name)}"`,
      `Failed to unpack canvas app '${name}' (${label}).`
    );
  }
  ok(`Unpacked canvas apps from ${label}`);
}

// Lists the files that differ between two directory trees as { status, path }
// entries (status is git's name-status letter: M/A/D). path is relative to
// both roots, e.g. "Entities/foo/Formulas/bar.xaml".
function listChangedFiles(pathA, pathB) {
  try {
    const output = execSync(
      `git diff --no-index --no-renames --name-status -- "${pathA}" "${pathB}"`,
      EXEC_OPTS
    );
    return parseNameStatus(output, pathA, pathB);
  } catch (err) {
    if (err.status === 1) return parseNameStatus(err.stdout || "", pathA, pathB);
    console.error(err.stderr || err.message);
    fail("Failed to list changed files.");
  }
}

// git's --name-status echoes back the whole pathspec it matched against, not
// a bare relative path: for M/D it's "<pathA>/<relPath>", for A (only found
// under pathB) it's "<pathB>/<relPath>". Strip whichever root applies so we
// get a clean relative path usable under both roots.
function parseNameStatus(output, pathA, pathB) {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split("\t");
      const fullPath = rest.join("\t");
      const root = status === "A" ? pathB : pathA;
      return { status, path: stripRoot(fullPath, root) };
    });
}

function stripRoot(fullPath, root) {
  const normalizedRoot = root.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedFull = fullPath.replace(/\\/g, "/");
  if (normalizedFull.startsWith(`${normalizedRoot}/`)) {
    return normalizedFull.slice(normalizedRoot.length + 1);
  }
  return normalizedFull;
}

function waitForEnter(promptText) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(promptText, () => {
      rl.close();
      resolve();
    });
  });
}

// Diffs two directory trees with git (works even outside a repo's tracked
// files), one file at a time, pausing for Enter between each. "local" is
// your existing unpacked copy (the old code); "environment" is the fresh
// export just pulled down (the new code). Returns true if differences were
// found, false if identical.
async function diffDirs(pathA, pathB, label) {
  step(`Diffing ${label} (local = old, environment = new)...`);
  const changes = listChangedFiles(pathA, pathB);
  if (changes.length === 0) {
    ok(`No differences in ${label}`);
    return false;
  }

  console.log(`   ${changes.length} file(s) changed:`);
  for (const change of changes) console.log(`     ${change.status}  ${change.path}`);

  for (const [index, change] of changes.entries()) {
    console.log(cyan(`\n---- [${index + 1}/${changes.length}] ${change.status}  ${change.path} ----`));
    const fileA = change.status === "A" ? "/dev/null" : join(pathA, change.path);
    const fileB = change.status === "D" ? "/dev/null" : join(pathB, change.path);
    try {
      execSync(
        `git diff --no-index --ignore-space-at-eol --src-prefix="local/" --dst-prefix="environment/" --color=always -- "${fileA}" "${fileB}"`,
        EXEC_OPTS
      );
    } catch (err) {
      if (err.status === 1) {
        console.log(err.stdout || "");
      } else {
        console.error(err.stderr || err.message);
        fail(`Diff failed for ${change.path}.`);
      }
    }

    if (index < changes.length - 1) {
      await waitForEnter("   Press Enter to view the next file...");
    }
  }
  return true;
}


// ---- 1. CHECK PAC IS INSTALLED ----
step("Checking pac CLI...");
const PAC = findPac();
if (!PAC) {
  fail("pac CLI not found. Install with: dotnet tool install --global Microsoft.PowerApps.CLI.Tool");
}
const pacHelpOutput = execSync(`${PAC} help`, { encoding: "utf8" });
const pacVersion = pacHelpOutput.match(/Version:\s*(\S+)/)?.[1] ?? "unknown";
ok(`pac found: ${pacVersion}`);


// ---- 2. AUTHENTICATE ----
step("Checking authentication...");
const authList = execSync(`${PAC} auth list`, { encoding: "utf8" });
if (authList.includes("No profiles")) {
  step("No auth profile found. Launching login...");
  run(`${PAC} auth create --url ${ENVIRONMENT_URL}`, "Authentication failed.");
} else {
  console.log("   Using existing auth profile. Switch with: pac auth select");
  console.log(authList.trim());
}


// ---- 3. MAKE SURE THERE'S A LOCAL COPY TO COMPARE AGAINST ----
if (!existsSync(OUTPUT_FOLDER)) {
  fail(`No local copy found at ${OUTPUT_FOLDER}. Run export-solutions.mjs first to create a baseline.`);
}


// ---- 4. EXPORT + UNPACK THE REMOTE SOLUTION INTO A TEMP WORKSPACE ----
const tempRoot = mkdtempSync(join(tmpdir(), "pac-diff-"));
const remoteZip = join(tempRoot, `${SOLUTION_NAME}.zip`);
const remoteFolder = join(tempRoot, "remote");
const localCanvasSrcRoot = join(tempRoot, "local-canvas-src");
const remoteCanvasSrcRoot = join(tempRoot, "remote-canvas-src");

try {
  step(`Exporting solution '${SOLUTION_NAME}' from ${ENVIRONMENT_URL}...`);
  const isManaged = PACKAGE_TYPE === "Managed";
  run(
    `${PAC} solution export --name ${SOLUTION_NAME} --path "${remoteZip}" --managed ${isManaged}`,
    "Export failed. Check the solution name and environment URL."
  );
  ok(`Exported to ${remoteZip}`);

  step(`Unpacking remote solution to ${remoteFolder}...`);
  run(
    `${PAC} solution unpack --zipfile "${remoteZip}" --folder "${remoteFolder}" --packagetype ${PACKAGE_TYPE}`,
    "Unpack failed."
  );
  ok("Remote solution unpacked");

  // ---- 5. UNPACK CANVAS APPS ON BOTH SIDES SO POWER FX IS READABLE ----
  unpackCanvasApps(PAC, join(OUTPUT_FOLDER, CANVAS_APPS_DIR), localCanvasSrcRoot, "local copy");
  unpackCanvasApps(PAC, join(remoteFolder, CANVAS_APPS_DIR), remoteCanvasSrcRoot, "environment");

  // ---- 6. DIFF LOCAL VS. REMOTE (LOCAL COPY IS NEVER WRITTEN TO) ----
  const solutionDiffers = await diffDirs(OUTPUT_FOLDER, remoteFolder, "solution files (entities, formulas, metadata, etc.)");
  const canvasDiffers = await diffDirs(localCanvasSrcRoot, remoteCanvasSrcRoot, "canvas app Power Fx source");

  console.log(green("\n============================================================"));
  console.log(green(
    solutionDiffers || canvasDiffers
      ? "  Done — differences found above."
      : "  Done — local copy matches the environment."
  ));
  console.log(green("============================================================\n"));
} finally {
  step("Cleaning up temp workspace...");
  rmSync(tempRoot, { recursive: true, force: true });
}
