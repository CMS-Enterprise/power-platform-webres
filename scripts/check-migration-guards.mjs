import fs from "node:fs/promises";
import path from "node:path";

const manifestPath = path.resolve("apps/it-governance/migrations/dataflows.manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const scriptRoot = path.resolve(manifest.scriptRoot);

// Staging dataflows create only staging rows. The Running Migration guard contract
// applies to the downstream migration dataflows that create or update destination rows.
const migrationFlows = manifest.dataflows.filter(({ file }) => !file.startsWith("00-stage-"));
const manifestMigrationFiles = new Set(migrationFlows.map(({ file }) => file));

const contracts = new Map([
  ["01-create-lcids.m", { destinationBatch: "cr69a_batchid" }],
  ["02-create-cedar-systems.m", { destinationBatch: "cr3ee_batchid" }],
  ["03-create-requests.m", { destinationBatch: "cr69a_batchid" }],
  ["03-create-reviews.m", { destinationBatch: "cr3ee_batchid" }],
  ["03-link-requests-to-reviews.m", { destinationBatch: "cr69a_batchid" }],
  ["04-create-funding-sources.m", { destinationBatch: "cr69a_batchid" }],
  ["04-link-lcids-to-requests.m", { destinationBatch: "cr69a_batchid" }],
  ["05-create-additional-contacts.m", { destinationBatch: "cr69a_batchid" }],
  ["05-create-business-cases-and-solutions.m", { destinationBatch: "cr69a_batchid" }],
  ["05-create-documents.m", { destinationBatch: "cr69a_batchid" }],
  ["05-create-edit-requests.m", { destinationBatch: "cr69a_batchid" }],
  ["05-create-grb-activity-logs.m", { destinationBatch: "cr3ee_batchid" }],
  ["05-create-system-links.m", { destinationBatch: "cr69a_batchid" }],
  ["05-update-contract-numbers.m", { destinationBatch: "cr69a_batchid" }],
  ["06-create-estimated-lifecycle-costs.m", { destinationBatch: "cr69a_batchid" }],
  ["07-update-request-multi-selects.m", { destinationBatch: "cr69a_batchid", guardRoots: 2 }],
]);

const countMatches = (source, pattern) => source.match(pattern)?.length ?? 0;
const failures = [];

const unmanifestedMigrationFiles = (await fs.readdir(scriptRoot))
  .filter((file) => file.endsWith(".m") && !file.startsWith("00-stage-") && !manifestMigrationFiles.has(file));
for (const file of unmanifestedMigrationFiles) {
  failures.push(`${file}: destination-producing script is not present in the dataflow manifest`);
}

for (const { file, name } of migrationFlows) {
  const contract = contracts.get(file);
  if (!contract) {
    failures.push(`${file}: missing an explicit destination-batch contract (${name})`);
    continue;
  }

  let source;
  try {
    source = await fs.readFile(path.join(scriptRoot, file), "utf8");
  } catch (error) {
    failures.push(`${file}: cannot read script (${error.message})`);
    continue;
  }

  const guardRoots = contract.guardRoots ?? 1;
  const checks = [
    ["Running status filter", /easi_migrationrunstatus\]\s*=\s*100000000/g, guardRoots],
    ["Running row count", /RunningCount\s*=\s*Table\.RowCount\(RunningOnly\)/g, guardRoots],
    ["zero-Running failure", /if\s+RunningCount\s*=\s*0\s+then/g, guardRoots],
    ["multiple-Running failure", /else\s+if\s+RunningCount\s*>\s*1\s+then/g, guardRoots],
    ["validated run batch lookup", /Record\.FieldOrDefault\(ValidatedRunningRun,\s*"easi_batchid",\s*null\)/g, guardRoots],
    ["loaded-path guard dependency", /GuardedStage\s*=\s*if\s+Text\.Length\(BatchId\)\s*>\s*0\s+then/g, guardRoots],
    ["current-batch staging filter", /CurrentBatchStage\s*=\s*Table\.SelectRows\(/g, guardRoots],
    ["case-insensitive batch comparison", /Text\.Lower\(Text\.Trim\(Text\.From\(stageBatchId\)\)\)\s*=\s*Text\.Lower\(BatchId\)/g, guardRoots],
    ["validated batch stamp", /each\s+BatchId,\s*type\s+text/g, guardRoots],
  ];

  for (const [label, pattern, minimum] of checks) {
    const actual = countMatches(source, pattern);
    if (actual < minimum) {
      failures.push(`${file}: ${label} found ${actual} time(s); expected at least ${minimum}`);
    }
  }

  if (!source.includes(`"${contract.destinationBatch}"`)) {
    failures.push(`${file}: destination batch column ${contract.destinationBatch} is not referenced`);
  }
}

for (const file of contracts.keys()) {
  if (!migrationFlows.some((flow) => flow.file === file)) {
    failures.push(`${file}: guard contract has no matching non-staging manifest entry`);
  }
}

if (failures.length > 0) {
  console.error("Running Migration guard coverage failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Running Migration guard coverage passed for ${migrationFlows.length} destination-producing dataflows.`);
}
