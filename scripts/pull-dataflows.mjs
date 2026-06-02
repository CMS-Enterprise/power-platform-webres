#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  DEFAULT_DATAFLOW_MANIFEST,
  findDataflow,
  getAccessToken,
  getModifiedBy,
  loadEnv,
  normalizeMashupDocument,
  normalizeRelativePath,
  readJson,
  resolveManifestPath,
  validateDataverseEnv,
} from "./dataflow-common.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const env = loadEnv(path.join(repoRoot, ".env"));
  validateDataverseEnv(env);

  const manifestPath = resolveManifestPath(repoRoot, args.manifest);
  const manifest = readJson(manifestPath);
  validateManifest(manifest);

  const scriptRoot = path.resolve(repoRoot, manifest.scriptRoot);
  const entries = buildEntryPlan({
    manifest,
    scriptRoot,
    filterFiles: args.files,
  });

  if (entries.length === 0) {
    throw new Error("No manifest dataflows matched the provided filters.");
  }

  const dataverseUrl = env.DATAVERSE_URL.replace(/\/$/, "");
  const token = await getAccessToken(env, dataverseUrl);

  console.log(`Pulling ${entries.length} dataflow(s) from ${dataverseUrl}`);

  for (const entry of entries) {
    const remote = await findDataflow({
      dataverseUrl,
      token,
      dataflowId: entry.dataflowId,
      name: entry.name,
    });

    if (!remote) {
      throw new Error(`Dataflow '${entry.name || entry.dataflowId}' was not found.`);
    }

    const content = normalizeMashupDocument(remote.msdyn_mashupdocument);
    await mkdir(path.dirname(entry.absolutePath), { recursive: true });
    await writeFile(entry.absolutePath, content, "utf8");

    console.log(entry.file);
    console.log(`dataflow: ${remote.msdyn_name}`);
    console.log(`dataflow id: ${remote.msdyn_dataflowid}`);
    if (remote.modifiedon) {
      console.log(`remote modified: ${new Date(remote.modifiedon).toISOString()}`);
    }
    const modifiedBy = getModifiedBy(remote);
    if (modifiedBy) {
      console.log(`remote modified by: ${modifiedBy}`);
    }
    console.log("");
  }
}

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_DATAFLOW_MANIFEST,
    files: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--manifest") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--manifest requires a path.");
      }
      args.manifest = value;
      index += 1;
      continue;
    }

    if (current === "--file") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--file requires a relative file path.");
      }
      args.files.push(normalizeRelativePath(value));
      index += 1;
      continue;
    }

    if (current === "--help" || current === "-h") {
      printHelp();
      process.exit(0);
    }

    if (!current.startsWith("-")) {
      args.files.push(normalizeRelativePath(current));
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return args;
}

  console.log(`Usage:
  node ./scripts/pull-dataflows.mjs
  node ./scripts/pull-dataflows.mjs 00-stage-system-intakes.m
  node ./scripts/pull-dataflows.mjs --file 00-stage-system-intakes.m

Options:
  --file <relativePath>   Pull only one manifest entry. Repeatable.
  --manifest <path>       Path to the manifest file. Defaults to ${DEFAULT_DATAFLOW_MANIFEST}
  --help                  Show this help message.

Behavior:
  Writes each Dataverse dataflow mashup document to the local file mapped in the manifest.
`);
}

function validateManifest(manifest) {
  if (!manifest.scriptRoot) {
    throw new Error("Manifest must define scriptRoot.");
  }

  if (!Array.isArray(manifest.dataflows) || manifest.dataflows.length === 0) {
    throw new Error("Manifest dataflows must be a non-empty array.");
  }
}

function buildEntryPlan({ manifest, scriptRoot, filterFiles }) {
  const filters = new Set(filterFiles);

  return manifest.dataflows
    .map((entry) => {
      if (!entry.file) {
        throw new Error("Each dataflow manifest entry must include file.");
      }
      if (!entry.name && !entry.dataflowId) {
        throw new Error(
          `Dataflow manifest entry '${entry.file}' must include name or dataflowId.`,
        );
      }

      const file = normalizeRelativePath(entry.file);
      return {
        ...entry,
        file,
        absolutePath: path.resolve(scriptRoot, file),
      };
    })
    .filter((entry) => filters.size === 0 || filters.has(entry.file));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
