import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  compareVersions,
  getDirectoryChanges,
  loadSolutionConfig,
  normalizeSolutionFile,
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

test("solution normalization ignores only generated PAC identifiers", () => {
  const projectA = "<Project><ProjectGuid>11111111-1111-4111-8111-111111111111</ProjectGuid><Name>Keep me</Name></Project>";
  const projectB = "<Project><ProjectGuid>22222222-2222-4222-8222-222222222222</ProjectGuid><Name>Keep me</Name></Project>";
  const projectWithBracedGuid = "<Project><ProjectGuid>{22222222-2222-4222-8222-222222222222}</ProjectGuid><Name>Keep me</Name></Project>";
  const projectWithOpeningBraceOnly = "<Project><ProjectGuid>{22222222-2222-4222-8222-222222222222</ProjectGuid><Name>Keep me</Name></Project>";
  const projectWithClosingBraceOnly = "<Project><ProjectGuid>22222222-2222-4222-8222-222222222222}</ProjectGuid><Name>Keep me</Name></Project>";
  const projectWithEmptyGuid = "<Project><ProjectGuid></ProjectGuid><Name>Keep me</Name></Project>";
  const projectWithInvalidGuid = "<Project><ProjectGuid>NOT-A-GUID</ProjectGuid><Name>Keep me</Name></Project>";
  assert.equal(normalizeSolutionFile("Example.cdsproj", projectA), normalizeSolutionFile("Example.cdsproj", projectB));
  assert.notEqual(
    normalizeSolutionFile("Example.cdsproj", projectA),
    normalizeSolutionFile("Example.cdsproj", projectB.replace("Keep me", "Changed")),
  );
  assert.notEqual(
    normalizeSolutionFile("Example.cdsproj", projectA),
    normalizeSolutionFile("Example.cdsproj", projectWithEmptyGuid),
  );
  assert.notEqual(
    normalizeSolutionFile("Example.cdsproj", projectA),
    normalizeSolutionFile("Example.cdsproj", projectWithInvalidGuid),
  );
  assert.equal(
    normalizeSolutionFile("Example.cdsproj", projectA),
    normalizeSolutionFile("Example.cdsproj", projectWithBracedGuid),
  );
  assert.notEqual(
    normalizeSolutionFile("Example.cdsproj", projectA),
    normalizeSolutionFile("Example.cdsproj", projectWithOpeningBraceOnly),
  );
  assert.notEqual(
    normalizeSolutionFile("Example.cdsproj", projectA),
    normalizeSolutionFile("Example.cdsproj", projectWithClosingBraceOnly),
  );

  const connectionReferences = (workflowName, displayName = "Flow") =>
    `<CanvasApp><ConnectionReferences>${JSON.stringify({
      flow: {
        parameterHints: { workflowName: { value: workflowName }, workflowEntityId: { value: "stable" } },
        parameterHintsV2: { workflowName: { value: workflowName } },
        displayName,
      },
    })}</ConnectionReferences></CanvasApp>`;
  const canvasA = connectionReferences("11111111-1111-4111-8111-111111111111");
  const canvasB = connectionReferences("22222222-2222-4222-8222-222222222222");
  assert.equal(
    normalizeSolutionFile("src/CanvasApps/App.meta.xml", canvasA),
    normalizeSolutionFile("src/CanvasApps/App.meta.xml", canvasB),
  );
  assert.notEqual(
    normalizeSolutionFile("src/CanvasApps/App.meta.xml", canvasA),
    normalizeSolutionFile("src/CanvasApps/App.meta.xml", connectionReferences("22222222-2222-4222-8222-222222222222", "Changed")),
  );
});

test("directory comparison keeps meaningful changes while filtering generated identifiers", () => {
  const root = mkdtempSync(path.join(tmpdir(), "pac-directory-test-"));
  const local = path.join(root, "local");
  const remote = path.join(root, "remote");
  try {
    mkdirSync(path.join(local, "src", "Entities"), { recursive: true });
    mkdirSync(path.join(remote, "src", "Entities"), { recursive: true });
    writeFileSync(path.join(local, "Example.cdsproj"), "<ProjectGuid>11111111-1111-4111-8111-111111111111</ProjectGuid>");
    writeFileSync(path.join(remote, "Example.cdsproj"), "<ProjectGuid>22222222-2222-4222-8222-222222222222</ProjectGuid>");
    writeFileSync(path.join(local, "src", "Entities", "Entity.xml"), "<Description>Before</Description>");
    writeFileSync(path.join(remote, "src", "Entities", "Entity.xml"), "<Description>After</Description>");

    assert.equal(getDirectoryChanges(local, remote), "M\tsrc/Entities/Entity.xml");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
