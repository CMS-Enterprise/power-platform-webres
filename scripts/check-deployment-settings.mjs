import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const defaultRoot = path.resolve("apps/it-governance/deployment-settings");
const defaultExpectedConfigurationRoot = path.resolve(
  "apps/it-governance/migrations/dataflows/migration-dataflow-expected-configurations",
);
const environments = {
  dev: {
    id: "69e8387f-d121-ecfa-a34f-6e9d2e51754a-31c688f59-sovereign",
    url: "https://itgovernancedev.crm9.dynamics.com",
  },
  uat: {
    id: "3a8386b6-0bf9-e288-aaa3-3bb2b3342dd9-31c688f59-sovereign",
    url: "https://itgovernanceuat.crm9.dynamics.com",
  },
  prod: {
    id: "c2f580e9-c782-e16d-8d04-f5ae6a71ec20-31c688f59-sovereign",
    url: "https://itgovernance.crm9.dynamics.com",
  },
};

const embeddedJsonSchemas = new Set([
  "cr69a_MigrationDataflowConfiguration",
  "cr69a_MigrationDataflowExpectedConfiguration",
  "cr69a_StagingDataflowConfiguration",
]);
const dataflowListSchemas = new Set([
  "cr69a_MigrationDataflowConfiguration",
  "cr69a_StagingDataflowConfiguration",
]);
const unresolvedValues = new Set(["", "__REQUIRED__", "__SECRET_REQUIRED__"]);
const expectedConfigurationFields = [
  "EnvironmentName",
  "EnvironmentId",
  "DataverseEnvironmentUrl",
  "SharePointSiteUrl",
  "FolderPath",
];
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const dataflowInventory = (document) => {
  const inventories = new Map();
  for (const { SchemaName, Value } of document.EnvironmentVariables ?? []) {
    if (!dataflowListSchemas.has(SchemaName) || unresolvedValues.has(Value)) continue;
    try {
      const embedded = JSON.parse(Value);
      if (isObject(embedded.Dataflows)) inventories.set(SchemaName, Object.keys(embedded.Dataflows).sort().join("\n"));
    } catch {
      // validateDocument reports malformed embedded JSON with the file context.
    }
  }
  return inventories;
};

const compareInventories = (solution, baseline, candidate) => {
  const failures = [];
  const baselineVariables = (baseline.document.EnvironmentVariables ?? [])
    .map(({ SchemaName }) => SchemaName)
    .sort()
    .join("\n");
  const candidateVariables = (candidate.document.EnvironmentVariables ?? [])
    .map(({ SchemaName }) => SchemaName)
    .sort()
    .join("\n");
  const baselineConnections = (baseline.document.ConnectionReferences ?? [])
    .map(({ LogicalName, ConnectorId }) => `${LogicalName}\t${ConnectorId}`)
    .sort()
    .join("\n");
  const candidateConnections = (candidate.document.ConnectionReferences ?? [])
    .map(({ LogicalName, ConnectorId }) => `${LogicalName}\t${ConnectorId}`)
    .sort()
    .join("\n");

  if (candidateVariables !== baselineVariables) {
    failures.push(
      `${solution}: environment-variable schema differs between ${baseline.environment} and ${candidate.environment}`,
    );
  }
  if (candidateConnections !== baselineConnections) {
    failures.push(
      `${solution}: connection-reference schema differs between ${baseline.environment} and ${candidate.environment}`,
    );
  }

  const baselineDataflows = dataflowInventory(baseline.document);
  const candidateDataflows = dataflowInventory(candidate.document);
  const dataflowSchemas = new Set([
    ...baselineDataflows.keys(),
    ...candidateDataflows.keys(),
  ]);
  for (const schemaName of dataflowSchemas) {
    if (baselineDataflows.get(schemaName) !== candidateDataflows.get(schemaName)) {
      failures.push(
        `${solution}: ${schemaName} dataflow inventory differs between ${baseline.environment} and ${candidate.environment}`,
      );
    }
  }
  return failures;
};

export function validateDocument(
  document,
  { solution, environment, ready = false, expectedConfiguration } = {},
) {
  const failures = [];
  const label = `${solution ?? "unknown"}/${environment ?? "unknown"}`;
  const expectedEnvironment = environments[environment];
  if (!expectedEnvironment) failures.push(`${label}: unsupported environment`);
  if (!isObject(document)) return [`${label}: document must be a JSON object`];
  if (!Array.isArray(document.EnvironmentVariables)) failures.push(`${label}: EnvironmentVariables must be an array`);
  if (!Array.isArray(document.ConnectionReferences)) failures.push(`${label}: ConnectionReferences must be an array`);
  if (failures.length > 0) return failures;

  const schemas = new Set();
  for (const [index, variable] of document.EnvironmentVariables.entries()) {
    const itemLabel = `${label}: EnvironmentVariables[${index}]`;
    if (!isObject(variable) || typeof variable.SchemaName !== "string" || typeof variable.Value !== "string") {
      failures.push(`${itemLabel} must contain string SchemaName and Value fields`);
      continue;
    }
    if (!isObject(variable.Name) || typeof variable.Name.Default !== "string" || variable.Name.Default.trim() === "") {
      failures.push(`${itemLabel} must contain a non-empty Name.Default display name`);
    }
    if (schemas.has(variable.SchemaName)) failures.push(`${label}: duplicate environment variable ${variable.SchemaName}`);
    schemas.add(variable.SchemaName);
    if (ready && unresolvedValues.has(variable.Value.trim())) failures.push(`${label}: ${variable.SchemaName} is unresolved`);

    if (embeddedJsonSchemas.has(variable.SchemaName) && !unresolvedValues.has(variable.Value)) {
      if (variable.Value.length > 2000) failures.push(`${label}: ${variable.SchemaName} exceeds the 2,000-character Power Platform limit`);
      let embedded;
      try {
        embedded = JSON.parse(variable.Value);
      } catch (error) {
        failures.push(`${label}: ${variable.SchemaName} is not valid embedded JSON (${error.message})`);
        continue;
      }
      if (!isObject(embedded)) {
        failures.push(`${label}: ${variable.SchemaName} embedded value must be an object`);
        continue;
      }
      if (expectedEnvironment && embedded.EnvironmentId !== expectedEnvironment.id) {
        failures.push(`${label}: ${variable.SchemaName} EnvironmentId does not match ${environment}`);
      }
      if (variable.SchemaName === "cr69a_MigrationDataflowExpectedConfiguration") {
        for (const field of expectedConfigurationFields) {
          if (typeof embedded[field] !== "string" || embedded[field].trim() === "") {
            failures.push(`${label}: ${variable.SchemaName} must contain a non-empty ${field}`);
          } else if (expectedConfiguration && embedded[field] !== expectedConfiguration[field]) {
            failures.push(`${label}: ${variable.SchemaName} ${field} does not match ${environment}`);
          }
        }
      }
      if (dataflowListSchemas.has(variable.SchemaName)) {
        if (!isObject(embedded.Dataflows) || Object.keys(embedded.Dataflows).length === 0) {
          failures.push(`${label}: ${variable.SchemaName} must contain a non-empty Dataflows object`);
        } else {
          for (const [name, id] of Object.entries(embedded.Dataflows)) {
            if (typeof id !== "string" || id.trim() === "" || (ready && unresolvedValues.has(id.trim()))) {
              failures.push(`${label}: ${variable.SchemaName} dataflow ${name} has no ID`);
            } else if (!unresolvedValues.has(id.trim()) && !guidPattern.test(id.trim())) {
              failures.push(`${label}: ${variable.SchemaName} dataflow ${name} ID is not a GUID`);
            }
          }
        }
      }
    }
  }

  const logicalNames = new Set();
  for (const [index, reference] of document.ConnectionReferences.entries()) {
    const itemLabel = `${label}: ConnectionReferences[${index}]`;
    if (!isObject(reference) || typeof reference.LogicalName !== "string" ||
        typeof reference.ConnectionId !== "string" || typeof reference.ConnectorId !== "string") {
      failures.push(`${itemLabel} must contain string LogicalName, ConnectionId, and ConnectorId fields`);
      continue;
    }
    if (logicalNames.has(reference.LogicalName)) failures.push(`${label}: duplicate connection reference ${reference.LogicalName}`);
    logicalNames.add(reference.LogicalName);
    if (!reference.ConnectorId.startsWith("/providers/Microsoft.PowerApps/apis/")) {
      failures.push(`${label}: ${reference.LogicalName} has an invalid ConnectorId`);
    }
    if (ready && unresolvedValues.has(reference.ConnectionId)) failures.push(`${label}: ${reference.LogicalName} connection is unresolved`);
  }

  const orgBaseUrl = document.EnvironmentVariables.find((variable) => variable?.SchemaName === "new_OrgBaseUrl")?.Value;
  if (orgBaseUrl && !unresolvedValues.has(orgBaseUrl) && expectedEnvironment && orgBaseUrl !== expectedEnvironment.url) {
    failures.push(`${label}: new_OrgBaseUrl does not match ${environment}`);
  }
  return failures;
}

export async function validateTree({
  root = defaultRoot,
  ready = false,
  solution,
  environment,
  settingsFile,
  expectedConfigurationRoot = defaultExpectedConfigurationRoot,
} = {}) {
  const failures = [];
  const documents = [];
  const solutions = solution ? [solution] : (await fs.readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const targetEnvironments = environment ? [environment] : Object.keys(environments);

  for (const solutionName of solutions) {
    for (const environmentName of targetEnvironments) {
      const file = settingsFile ?? path.join(root, solutionName, `${environmentName}.json`);
      let document;
      try {
        document = JSON.parse(await fs.readFile(file, "utf8"));
      } catch (error) {
        failures.push(`${solutionName}/${environmentName}: cannot read valid JSON from ${file} (${error.message})`);
        continue;
      }
      documents.push({ solution: solutionName, environment: environmentName, document });
      let expectedConfiguration;
      const hasExpectedConfiguration = document.EnvironmentVariables?.some(
        (variable) => variable?.SchemaName === "cr69a_MigrationDataflowExpectedConfiguration",
      );
      if (hasExpectedConfiguration) {
        const expectedFile = path.join(expectedConfigurationRoot, `${environmentName}.json`);
        try {
          expectedConfiguration = JSON.parse(await fs.readFile(expectedFile, "utf8"));
        } catch (error) {
          failures.push(
            `${solutionName}/${environmentName}: cannot read expected migration configuration from ${expectedFile} (${error.message})`,
          );
        }
      }
      failures.push(...validateDocument(document, {
        solution: solutionName,
        environment: environmentName,
        ready,
        expectedConfiguration,
      }));
    }
  }

  for (const solutionName of solutions) {
    const solutionDocuments = documents.filter((item) =>
      item.solution === solutionName &&
      isObject(item.document) &&
      Array.isArray(item.document.EnvironmentVariables) &&
      item.document.EnvironmentVariables.every(isObject) &&
      Array.isArray(item.document.ConnectionReferences) &&
      item.document.ConnectionReferences.every(isObject));
    if (ready) {
      const candidate = solutionDocuments[0];
      if (!candidate) continue;
      const referenceEnvironment = Object.keys(environments).find(
        (name) => name !== environment,
      );
      const referenceFile = path.join(root, solutionName, `${referenceEnvironment}.json`);
      try {
        const reference = {
          solution: solutionName,
          environment: referenceEnvironment,
          document: JSON.parse(await fs.readFile(referenceFile, "utf8")),
        };
        failures.push(...compareInventories(solutionName, reference, candidate));
      } catch (error) {
        failures.push(
          `${solutionName}/${referenceEnvironment}: cannot read inventory reference from ${referenceFile} (${error.message})`,
        );
      }
      continue;
    }

    if (solutionDocuments.length < 2) continue;
    const baseline = solutionDocuments[0];
    for (const candidate of solutionDocuments.slice(1)) {
      failures.push(...compareInventories(solutionName, baseline, candidate));
    }
  }
  return { failures, checked: documents.length };
}

async function main() {
  const args = process.argv.slice(2);
  const ready = args[0] === "--ready";
  const positional = ready ? args.slice(1) : args;
  const hasSettingsFile = ready && positional.length === 4 && positional[2] === "--file";
  if ((!ready && positional.length > 0) || (ready && positional.length !== 2 && !hasSettingsFile)) {
    console.error(
      "Usage: node scripts/check-deployment-settings.mjs [--ready <solution> <dev|uat|prod> [--file <settings.json>]]",
    );
    process.exitCode = 2;
    return;
  }
  const [solution, environment] = positional;
  const settingsFile = hasSettingsFile ? path.resolve(positional[3]) : undefined;
  const { failures, checked } = await validateTree({
    ready,
    solution,
    environment,
    settingsFile,
  });
  if (failures.length > 0) {
    console.error(`${ready ? "Deployment readiness" : "Deployment settings"} check failed:\n`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${ready ? "Deployment readiness" : "Deployment settings"} check passed for ${checked} file(s).`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
