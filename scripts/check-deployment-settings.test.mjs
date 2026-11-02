import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateDocument, validateTree } from "./check-deployment-settings.mjs";

const devId = "69e8387f-d121-ecfa-a34f-6e9d2e51754a-31c688f59-sovereign";
const validDocument = () => ({
  EnvironmentVariables: [
    { Name: { Default: "OrgBaseUrl" }, SchemaName: "new_OrgBaseUrl", Value: "https://itgovernancedev.crm9.dynamics.com" },
    { Name: { Default: "Staging Dataflow Configuration" }, SchemaName: "cr69a_StagingDataflowConfiguration", Value: JSON.stringify({ EnvironmentId: devId, Dataflows: { StageRequests: "abc" } }) },
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
  document.EnvironmentVariables[1].Value = JSON.stringify({ EnvironmentId: "wrong", Dataflows: { StageRequests: "abc" } });
  assert.match(validate(document).join("\n"), /EnvironmentId does not match dev/);
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
      const dataflows = environment === "prod" ? { StageRequests: "abc" } : { StageRequests: "abc", StageNotes: "def" };
      document.EnvironmentVariables[1].Value = JSON.stringify({ EnvironmentId: environmentId, Dataflows: dataflows });
      await fs.writeFile(path.join(solution, `${environment}.json`), JSON.stringify(document));
    }
    const { failures } = await validateTree({ root });
    assert.match(failures.join("\n"), /dataflow inventory differs/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
