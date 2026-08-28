#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import {
  getAccessToken,
  getModifiedBy,
  listDataflows,
  loadEnv,
  validateDataverseEnv,
} from "./dataflow-common.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const env = loadEnv(path.join(repoRoot, ".env"));
  validateDataverseEnv(env);

  const dataverseUrl = env.DATAVERSE_URL.replace(/\/$/, "");
  const token = await getAccessToken(env, dataverseUrl);
  const dataflows = await listDataflows({ dataverseUrl, token });

  if (dataflows.length === 0) {
    console.log(`No dataflows found in ${dataverseUrl}.`);
    return;
  }

  console.log(`Dataflows in ${dataverseUrl}`);
  console.log("");

  for (const dataflow of dataflows) {
    const mashupDocument = dataflow.msdyn_mashupdocument || "";
    const mashupSettings = dataflow.msdyn_mashupsettings || "";

    console.log(dataflow.msdyn_name || "(unnamed dataflow)");
    console.log(`  Dataverse record id: ${dataflow.msdyn_dataflowid}`);
    console.log(
      `  Power Automate dataflow id: ${dataflow.msdyn_originaldataflowid || "unknown"}`,
    );
    console.log(`  created: ${formatDate(dataflow.createdon)}`);
    console.log(`  modified: ${formatDate(dataflow.modifiedon)}`);
    const modifiedBy = getModifiedBy(dataflow);
    if (modifiedBy) {
      console.log(`  modified by: ${modifiedBy}`);
    }
    console.log(`  mashup document: ${mashupDocument.length} chars`);
    if (args.verbose) {
      console.log(`  mashup settings: ${mashupSettings.length} chars`);
      console.log(`  state: ${formatState(dataflow)}`);
      console.log(`  component state: ${formatComponentState(dataflow)}`);
      console.log(`  managed: ${dataflow.ismanaged ? "yes" : "no"}`);
    }
    console.log("");
  }
}

function parseArgs(argv) {
  const args = {
    verbose: false,
  };

  for (const current of argv) {
    if (current === "--verbose") {
      args.verbose = true;
      continue;
    }

    if (current === "--help" || current === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/list-dataflows.mjs

Options:
  --verbose   Include extra Dataverse state/settings details.
  --help      Show this help message.
`);
}

function formatDate(value) {
  return value ? new Date(value).toISOString() : "unknown";
}

function formatState(dataflow) {
  const state =
    dataflow["statecode@OData.Community.Display.V1.FormattedValue"] ||
    dataflow.statecode;
  const status =
    dataflow["statuscode@OData.Community.Display.V1.FormattedValue"] ||
    dataflow.statuscode;
  return [state, status].filter((value) => value !== undefined).join(" / ");
}

function formatComponentState(dataflow) {
  return (
    dataflow["componentstate@OData.Community.Display.V1.FormattedValue"] ||
    dataflow.componentstate ||
    "unknown"
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
