import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateDocument, validateTree } from "./check-deployment-settings.mjs";

const devId = "69e8387f-d121-ecfa-a34f-6e9d2e51754a-31c688f59-sovereign";
const stageRequestsId = "11111111-1111-1111-1111-111111111111";
const stageNotesId = "22222222-2222-2222-2222-222222222222";
const uatStageRequestsId = "33333333-3333-3333-3333-333333333333";
const devExpectedConfiguration = {
  EnvironmentName: "Dev",
  EnvironmentId: devId,
  DataverseEnvironmentUrl: "itgovernancedev.crm9.dynamics.com",
  SharePointSiteUrl: "https://cmsgovonline.sharepoint.com/",
  FolderPath: "sites/CMS-SharePoint-OIT-CIO_Library/EASi%20data%20migration/Development/",
};
const validDocument = () => ({
  EnvironmentVariables: [
    { Name: { Default: "OrgBaseUrl" }, SchemaName: "new_OrgBaseUrl", Value: "https://itgovernancedev.crm9.dynamics.com" },
    { Name: { Default: "Staging Dataflow Configuration" }, SchemaName: "cr69a_StagingDataflowConfiguration", Value: JSON.stringify({ EnvironmentId: devId, Dataflows: { StageRequests: stageRequestsId } }) },
  ],
  ConnectionReferences: [
    { LogicalName: "new_shareddataflows_1", ConnectionId: "connection-1", ConnectorId: "/providers/Microsoft.PowerApps/apis/shared_dataflows" },
  ],
});
const validate = (document, ready = false) => validateDocument(document, { solution: "Test", environment: "dev", ready });

test("accepts a valid PAC deployment settings document", () => {
  assert.deepEqual(validate(validDocument(), true), []);
});

test("structural mode permits documented placeholders but readiness rejects them", () => {
  const document = validDocument();
  document.EnvironmentVariables[0].Value = "__REQUIRED__";
  document.ConnectionReferences[0].ConnectionId = "__REQUIRED__";
  assert.deepEqual(validate(document), []);
  assert.equal(validate(document, true).length, 2);
});

test("structural mode permits an unresolved dataflow ID but readiness rejects it", () => {
  const document = validDocument();
  document.EnvironmentVariables[1].Value = JSON.stringify({ EnvironmentId: devId, Dataflows: { StageRequests: "__REQUIRED__" } });
  assert.deepEqual(validate(document), []);
  assert.match(validate(document, true).join("\n"), /has no ID/);
});

test("rejects duplicate schema and logical names", () => {
  const document = validDocument();
  document.EnvironmentVariables.push({ ...document.EnvironmentVariables[0] });
  document.ConnectionReferences.push({ ...document.ConnectionReferences[0] });
  assert.match(validate(document).join("\n"), /duplicate environment variable/);
  assert.match(validate(document).join("\n"), /duplicate connection reference/);
});

test("requires a friendly display name for every variable", () => {
  const document = validDocument();
  delete document.EnvironmentVariables[0].Name;
  assert.match(validate(document).join("\n"), /Name.Default display name/);
});

test("rejects malformed embedded JSON", () => {
  const document = validDocument();
  document.EnvironmentVariables[1].Value = "{";
  assert.match(validate(document).join("\n"), /not valid embedded JSON/);
});

test("rejects a cross-environment ID", () => {
  const document = validDocument();
  document.EnvironmentVariables[1].Value = JSON.stringify({ EnvironmentId: "wrong", Dataflows: { StageRequests: stageRequestsId } });
  assert.match(validate(document).join("\n"), /EnvironmentId does not match dev/);
});

test("rejects resolved dataflow IDs that are not GUIDs", () => {
  const document = validDocument();
  document.EnvironmentVariables[1].Value = JSON.stringify({ EnvironmentId: devId, Dataflows: { StageRequests: "abc" } });
  assert.match(validate(document).join("\n"), /ID is not a GUID/);
});

test("requires the complete expected migration configuration and matches its source file", () => {
  const document = validDocument();
  document.EnvironmentVariables.push({
    Name: { Default: "Migration Dataflow Expected Configuration" },
    SchemaName: "cr69a_MigrationDataflowExpectedConfiguration",
    Value: JSON.stringify(devExpectedConfiguration),
  });
  assert.deepEqual(validateDocument(document, {
    solution: "Test",
    environment: "dev",
    ready: true,
    expectedConfiguration: devExpectedConfiguration,
  }), []);

  const mixedEnvironment = structuredClone(document);
  const embedded = JSON.parse(mixedEnvironment.EnvironmentVariables[2].Value);
  embedded.FolderPath = "sites/wrong-environment/";
  mixedEnvironment.EnvironmentVariables[2].Value = JSON.stringify(embedded);
  assert.match(validateDocument(mixedEnvironment, {
    solution: "Test",
    environment: "dev",
    ready: true,
    expectedConfiguration: devExpectedConfiguration,
  }).join("\n"), /FolderPath does not match dev/);

  const incomplete = structuredClone(document);
  const incompleteEmbedded = JSON.parse(incomplete.EnvironmentVariables[2].Value);
  delete incompleteEmbedded.SharePointSiteUrl;
  incomplete.EnvironmentVariables[2].Value = JSON.stringify(incompleteEmbedded);
  assert.match(validate(incomplete).join("\n"), /non-empty SharePointSiteUrl/);
});

test("rejects missing dataflow IDs", () => {
  const document = validDocument();
  document.EnvironmentVariables[1].Value = JSON.stringify({ EnvironmentId: devId, Dataflows: { StageRequests: "" } });
  assert.match(validate(document).join("\n"), /has no ID/);
});

test("rejects embedded dataflow configuration over 2,000 characters", () => {
  const document = validDocument();
  document.EnvironmentVariables[1].Value = JSON.stringify({ EnvironmentId: devId, Dataflows: { StageRequests: "x".repeat(2000) } });
  assert.match(validate(document).join("\n"), /exceeds the 2,000-character/);
});

test("rejects dataflow inventories that differ across environments", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "deployment-settings-test-"));
  try {
    const solution = path.join(root, "Test");
    await fs.mkdir(solution);
    for (const environment of ["dev", "uat", "prod"]) {
      const document = validDocument();
      const environmentId = environment === "dev"
        ? devId
        : environment === "uat"
          ? "3a8386b6-0bf9-e288-aaa3-3bb2b3342dd9-31c688f59-sovereign"
          : "c2f580e9-c782-e16d-8d04-f5ae6a71ec20-31c688f59-sovereign";
      document.EnvironmentVariables[0].Value = `https://itgovernance${environment === "prod" ? "" : environment}.crm9.dynamics.com`;
      const dataflows = environment === "prod"
        ? { StageRequests: stageRequestsId }
        : { StageRequests: stageRequestsId, StageNotes: stageNotesId };
      document.EnvironmentVariables[1].Value = JSON.stringify({ EnvironmentId: environmentId, Dataflows: dataflows });
      await fs.writeFile(path.join(solution, `${environment}.json`), JSON.stringify(document));
    }
    const { failures } = await validateTree({ root });
    assert.match(failures.join("\n"), /dataflow inventory differs/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("readiness rejects a selected file with a missing required variable or dataflow", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "deployment-settings-ready-test-"));
  try {
    const solution = path.join(root, "Test");
    await fs.mkdir(solution);
    for (const environment of ["dev", "uat", "prod"]) {
      const document = validDocument();
      const environmentId = environment === "dev"
        ? devId
        : environment === "uat"
          ? "3a8386b6-0bf9-e288-aaa3-3bb2b3342dd9-31c688f59-sovereign"
          : "c2f580e9-c782-e16d-8d04-f5ae6a71ec20-31c688f59-sovereign";
      document.EnvironmentVariables[0].Value = `https://itgovernance${environment === "prod" ? "" : environment}.crm9.dynamics.com`;
      document.EnvironmentVariables[1].Value = JSON.stringify({
        EnvironmentId: environmentId,
        Dataflows: { StageRequests: stageRequestsId, StageNotes: stageNotesId },
      });
      if (environment === "uat") {
        document.EnvironmentVariables.shift();
        document.EnvironmentVariables[0].Value = JSON.stringify({
          EnvironmentId: environmentId,
          Dataflows: { StageNotes: stageNotesId },
        });
      }
      await fs.writeFile(path.join(solution, `${environment}.json`), JSON.stringify(document));
    }

    const { failures } = await validateTree({
      root,
      ready: true,
      solution: "Test",
      environment: "uat",
    });
    assert.match(failures.join("\n"), /environment-variable schema differs/);
    assert.match(failures.join("\n"), /dataflow inventory differs/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("readiness validates an external materialized file against the checked-in inventory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "deployment-settings-file-test-"));
  try {
    const solution = path.join(root, "Test");
    await fs.mkdir(solution);
    for (const environment of ["dev", "uat", "prod"]) {
      await fs.writeFile(path.join(solution, `${environment}.json`), JSON.stringify(validDocument()));
    }

    const materializedFile = path.join(root, "materialized-uat.json");
    const materialized = validDocument();
    materialized.EnvironmentVariables[0].Value = "https://itgovernanceuat.crm9.dynamics.com";
    materialized.EnvironmentVariables[1].Value = JSON.stringify({
      EnvironmentId: "3a8386b6-0bf9-e288-aaa3-3bb2b3342dd9-31c688f59-sovereign",
      Dataflows: { StageRequests: uatStageRequestsId },
    });
    await fs.writeFile(materializedFile, JSON.stringify(materialized));

    const { failures, checked } = await validateTree({
      root,
      ready: true,
      solution: "Test",
      environment: "uat",
      settingsFile: materializedFile,
    });
    assert.deepEqual(failures, []);
    assert.equal(checked, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
