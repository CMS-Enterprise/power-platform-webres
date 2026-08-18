import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function validateEnvironmentUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("environmentUrl must be an absolute HTTPS URL.");
  }

  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("environmentUrl must be a plain HTTPS environment URL without credentials, query parameters, or a fragment.");
  }

  return url.toString().replace(/\/$/, "");
}

export function validateSolutionName(value) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value ?? "")) {
    throw new Error("solutionUniqueName must contain only letters, numbers, and underscores, and start with a letter.");
  }
  return value;
}

export function resolveContainedPath(repoRoot, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error("The configured path must be repository-relative.");
  }

  const root = path.resolve(repoRoot);
  const resolved = path.resolve(root, relativePath);
  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("The configured path must resolve to a folder inside the repository.");
  }
  return resolved;
}

export function loadSolutionConfig(repoRoot, configPath = "apps/it-governance/solution-source.json") {
  const absoluteConfigPath = resolveContainedPath(repoRoot, configPath);
  let config;
  try {
    config = JSON.parse(readFileSync(absoluteConfigPath, "utf8"));
  } catch (error) {
    throw new Error(`Could not read PAC solution config at ${configPath}: ${error.message}`);
  }

  const environmentUrl = validateEnvironmentUrl(config.environmentUrl ?? "");
  const solutionName = validateSolutionName(config.solutionUniqueName);
  const outputFolder = resolveContainedPath(repoRoot, config.outputPath ?? "");
  return { environmentUrl, solutionName, outputFolder };
}

export function findPac(baseEnv = process.env) {
  try {
    execFileSync("pac", ["help"], { stdio: "ignore" });
    return "pac";
  } catch {}

  const homeDir = baseEnv.USERPROFILE ?? baseEnv.HOME;
  if (!homeDir) return null;

  const candidates = [
    path.join(homeDir, ".dotnet", "tools", "pac.exe"),
    path.join(homeDir, ".dotnet", "tools", "pac"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function requirePacVersion(pac, minimumVersion = "2.4.1") {
  const help = run(pac, ["help"], { errorMessage: "Could not determine the PAC CLI version." });
  const installedVersion = parsePacVersion(help);
  if (!installedVersion) {
    throw new Error("Could not parse the PAC CLI version from 'pac help'.");
  }
  if (compareVersions(installedVersion, minimumVersion) < 0) {
    throw new Error(`PAC CLI ${minimumVersion} or newer is required; found ${installedVersion}.`);
  }
  return installedVersion;
}

export function parsePacVersion(output) {
  return output.match(/Version:\s*(\d+\.\d+\.\d+)/i)?.[1] ?? null;
}

export function requireCanvasPac(repoRoot, expectedVersion = "2.4.1") {
  let help;
  try {
    help = run("dotnet", ["tool", "run", "pac", "--", "help"], {
      cwd: repoRoot,
      errorMessage: "The repository-local canvas PAC tool is unavailable.",
    });
  } catch (error) {
    throw new Error(`${error.message}\nRun 'npm run pac:setup' from the repository root, then try again.`);
  }

  const installedVersion = parsePacVersion(help);
  if (installedVersion !== expectedVersion) {
    throw new Error(
      `Canvas source comparison requires repository-local PAC CLI ${expectedVersion}; found ${installedVersion ?? "an unknown version"}. ` +
      "Run 'npm run pac:setup' from the repository root.",
    );
  }

  return { command: "dotnet", args: ["tool", "run", "pac", "--"] };
}

export function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: options.stdio ?? ["inherit", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 200,
      cwd: options.cwd,
    });
  } catch (error) {
    const detail = error.stderr || error.stdout || error.message;
    throw new Error(`${options.errorMessage ?? `Command failed: ${command}`}\n${String(detail).trim()}`);
  }
}

export function cloneSolution({ pac, environmentUrl, solutionName, outputFolder }) {
  return run(pac, [
    "solution", "clone",
    "--environment", environmentUrl,
    "--name", solutionName,
    "--outputDirectory", outputFolder,
  ], { errorMessage: `Could not clone '${solutionName}' from ${environmentUrl}. Verify PAC authentication and solution access.` });
}

export function getWorkingTreeChanges(repoRoot, targetPath) {
  const relativePath = path.relative(repoRoot, targetPath);
  return run("git", ["status", "--porcelain=v1", "--untracked-files=all", "--", relativePath], {
    cwd: repoRoot,
    errorMessage: "Could not inspect the solution working tree.",
  }).trim();
}

export function getDirectoryChanges(pathA, pathB) {
  try {
    return execFileSync("git", ["diff", "--no-index", "--no-renames", "--name-status", "--", pathA, pathB], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 200,
    }).trim();
  } catch (error) {
    if (error.status === 1) return String(error.stdout ?? "").trim();
    throw new Error(`Could not compare solution folders.\n${String(error.stderr || error.message).trim()}`);
  }
}
