// ============================================================
// export-solution.mjs
// Exports and unpacks a Power Platform solution for source control
// Run with: node export-solution.mjs
// ============================================================

import { execSync } from "child_process";
import { existsSync, mkdtempSync, rmSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { createInterface } from "readline";

// ---- CONFIGURE THESE ----
const ENVIRONMENT_URL   = "https://itgovernancedev.crm9.dynamics.com"; // Your environment URL
const SOLUTION_NAME     = "InitialITGO";                 // Exact solution name (no spaces)
const OUTPUT_FOLDER     = `./${SOLUTION_NAME}`;               // Where to unpack files
const ZIP_PATH          = `./${SOLUTION_NAME}.zip`;           // Temp zip location
const PACKAGE_TYPE      = "Unmanaged";                        // Unmanaged | Managed | Both
const COMMIT_TO_GIT     = false;                              // Set to true to auto-commit after unpack
const GIT_COMMIT_MSG    = `chore: export ${SOLUTION_NAME} solution`;
// ---- END CONFIG ----


// ---- HELPERS ----
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;

function step(msg) { console.log(cyan(`\n>> ${msg}`)); }
function ok(msg)   { console.log(green(`   OK: ${msg}`)); }
function fail(msg) { console.error(red(`   ERROR: ${msg}`)); process.exit(1); }

// Resolve the pac executable — check PATH first, then the default .NET global tools location
function findPac() {
  // Try PATH first
  try {
    execSync("pac help", { encoding: "utf8", stdio: "ignore" });
    return "pac";
  } catch {}

  // Fall back to the default .NET global tools install location
  const dotnetToolsPath = join(process.env.USERPROFILE ?? process.env.HOME, ".dotnet", "tools", "pac.exe");
  if (existsSync(dotnetToolsPath)) return `"${dotnetToolsPath}"`;

  return null;
}

const EXEC_OPTS = { encoding: "utf8", stdio: ["inherit", "pipe", "pipe"], maxBuffer: 1024 * 1024 * 200 };

function run(cmd, errorMsg) {
  try {
    const output = execSync(cmd, EXEC_OPTS);
    if (output?.trim()) console.log("  ", output.trim());
    return output;
  } catch (err) {
    console.error(err.stdout || err.stderr || err.message);
    fail(errorMsg);
  }
}

function listChangedFiles(pathA, pathB) {
  try {
    const output = execSync(`git diff --no-index --no-renames --name-status -- "${pathA}" "${pathB}"`, EXEC_OPTS);
    return parseNameStatus(output, pathA, pathB);
  } catch (err) {
    if (err.status === 1) return parseNameStatus(err.stdout || "", pathA, pathB);
    console.error(err.stderr || err.message);
    fail("Failed to list changed WebResources files.");
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

function askYesNo(promptText) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

// Before the local unpack folder gets deleted and replaced, compare the
// WebResources files currently on disk (which may have local edits) against
// what's actually in the solution we just pulled from the environment. If
// they differ, show the diffs and require confirmation before overwriting.
async function guardLocalWebResourceEdits(zipPath, outputFolder) {
  const localWebResources = join(outputFolder, "WebResources");
  if (!existsSync(localWebResources)) return;

  step("Checking for local WebResources edits before overwrite...");
  const tempRoot = mkdtempSync(join(tmpdir(), "export-solutions-check-"));
  try {
    const remoteFolder = join(tempRoot, "remote");
    run(
      `${PAC} solution unpack --zipfile ${zipPath} --folder "${remoteFolder}" --packagetype ${PACKAGE_TYPE}`,
      "Pre-check unpack failed."
    );

    const remoteWebResources = join(remoteFolder, "WebResources");
    const changes = listChangedFiles(localWebResources, remoteWebResources);

    if (changes.length === 0) {
      ok("No local WebResources changes would be overwritten.");
      return;
    }

    console.log(yellow(`\n   ${changes.length} WebResources file(s) differ from what's about to be pulled:`));
    for (const change of changes) console.log(`     ${change.status}  ${change.path}`);

    for (const change of changes) {
      console.log(cyan(`\n---- ${change.status}  ${change.path} ----`));
      const fileA = change.status === "A" ? "/dev/null" : join(localWebResources, change.path);
      const fileB = change.status === "D" ? "/dev/null" : join(remoteWebResources, change.path);
      try {
        execSync(
          `git diff --no-index --ignore-space-at-eol --src-prefix="local/" --dst-prefix="environment/" --color=always -- "${fileA}" "${fileB}"`,
          EXEC_OPTS
        );
      } catch (err) {
        if (err.status === 1) console.log(err.stdout || "");
        else console.error(err.stderr || err.message);
      }
    }

    const proceed = await askYesNo(yellow("\n   Continue and overwrite these local changes? (y/N) "));
    if (!proceed) {
      console.log(yellow("   Aborted. No local files were changed."));
      process.exit(0);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
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


// ---- 3. EXPORT SOLUTION ----
step(`Exporting solution '${SOLUTION_NAME}' from ${ENVIRONMENT_URL}...`);
if (existsSync(ZIP_PATH)) {
  console.log(yellow(`   Removing leftover zip from a previous run: ${ZIP_PATH}`));
  unlinkSync(ZIP_PATH);
}
const isManaged = PACKAGE_TYPE === "Managed";
run(
  `${PAC} solution export --name ${SOLUTION_NAME} --path ${ZIP_PATH} --managed ${isManaged}`,
  "Export failed. Check the solution name and environment URL."
);
ok(`Exported to ${ZIP_PATH}`);


// ---- 4. GUARD AGAINST OVERWRITING LOCAL WEBRESOURCES EDITS ----
await guardLocalWebResourceEdits(ZIP_PATH, OUTPUT_FOLDER);


// ---- 5. CLEAN UP OLD UNPACK FOLDER ----
if (existsSync(OUTPUT_FOLDER)) {
  step("Removing existing unpack folder...");
  rmSync(resolve(OUTPUT_FOLDER), { recursive: true, force: true });
}


// ---- 6. UNPACK SOLUTION ----
step(`Unpacking solution to ${OUTPUT_FOLDER}...`);
run(
  `${PAC} solution unpack --zipfile ${ZIP_PATH} --folder ${OUTPUT_FOLDER} --packagetype ${PACKAGE_TYPE}`,
  "Unpack failed."
);
ok(`Unpacked to ${OUTPUT_FOLDER}`);


// ---- 7. REMOVE ZIP ----
step("Cleaning up zip file...");
unlinkSync(ZIP_PATH);
ok("Zip removed");


// ---- 8. OPTIONAL GIT COMMIT ----
if (COMMIT_TO_GIT) {
  step("Committing to Git...");
  try { execSync("git --version", { stdio: "ignore" }); }
  catch { fail("Git not found. Install git or set COMMIT_TO_GIT to false."); }

  run(`git add ${OUTPUT_FOLDER}`, "git add failed.");
  run(`git commit -m "${GIT_COMMIT_MSG}"`, "git commit failed.");
  ok(`Committed: ${GIT_COMMIT_MSG}`);
}


// ---- DONE ----
console.log(green("\n============================================================"));
console.log(green(`  Done! Solution unpacked to: ${OUTPUT_FOLDER}`));
if (COMMIT_TO_GIT) {
  console.log(green(`  Committed to Git: ${GIT_COMMIT_MSG}`));
} else {
  console.log(yellow("  Tip: Set COMMIT_TO_GIT = true to auto-commit after export."));
}
console.log(green("============================================================\n"));