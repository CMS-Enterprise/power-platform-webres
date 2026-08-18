import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  compareVersions,
  loadSolutionConfig,
  parsePacVersion,
  resolveContainedPath,
  validateEnvironmentUrl,
  validateSolutionName,
} from "./pac-solution-common.mjs";

test("PAC versions are compared numerically", () => {
  assert.equal(compareVersions("2.4.1", "2.4.1"), 0);
  assert.equal(compareVersions("2.10.0", "2.4.1"), 1);
  assert.equal(compareVersions("2.3.9", "2.4.1"), -1);
});

test("PAC versions are parsed from help output", () => {
  assert.equal(parsePacVersion("Microsoft PowerPlatform CLI\nVersion: 2.10.1+g52c3983 (.NET 10.0.11)"), "2.10.1");
  assert.equal(parsePacVersion("Version information unavailable"), null);
});

test("environment URLs must be plain HTTPS URLs", () => {
  assert.equal(validateEnvironmentUrl("https://dev.crm.dynamics.com/"), "https://dev.crm.dynamics.com");
  assert.throws(() => validateEnvironmentUrl("http://dev.crm.dynamics.com"), /plain HTTPS/);
  assert.throws(() => validateEnvironmentUrl("https://dev.crm.dynamics.com?wrong=environment"), /plain HTTPS/);
});

test("solution names reject paths and shell syntax", () => {
  assert.equal(validateSolutionName("InitialITGO_Dev"), "InitialITGO_Dev");
  assert.throws(() => validateSolutionName("../solution"), /letters, numbers, and underscores/);
  assert.throws(() => validateSolutionName("solution;whoami"), /letters, numbers, and underscores/);
});

test("solution path must remain inside the repository", () => {
  const repoRoot = path.resolve("/workspace/repo");
  assert.equal(
    resolveContainedPath(repoRoot, "apps/example/solution"),
    path.join(repoRoot, "apps/example/solution"),
  );
  assert.throws(() => resolveContainedPath(repoRoot, "../outside"), /inside the repository/);
  assert.throws(() => resolveContainedPath(repoRoot, repoRoot), /repository-relative/);
  assert.throws(() => resolveContainedPath(repoRoot, "."), /inside the repository/);
});

test("loadSolutionConfig reads a committed, reviewable source definition", () => {
  const root = mkdtempSync(path.join(tmpdir(), "pac-config-test-"));
  try {
    writeFileSync(path.join(root, "source.json"), JSON.stringify({
      environmentUrl: "https://dev.crm.dynamics.com",
      solutionUniqueName: "Example",
      outputPath: "apps/example/solution",
    }));
    assert.deepEqual(loadSolutionConfig(root, "source.json"), {
      environmentUrl: "https://dev.crm.dynamics.com",
      solutionName: "Example",
      outputFolder: path.join(root, "apps/example/solution"),
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
