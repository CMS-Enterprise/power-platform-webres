#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  DEFAULT_DATAFLOW_MANIFEST,
  findDataflow,
  getAccessToken,
  getModifiedBy,
  hashContent,
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
  const isDetailed = entries.length === 1;
  const results = [];

  console.log(`Checking ${entries.length} dataflow(s) against ${dataverseUrl}`);

  for (const entry of entries) {
    const remote = await findDataflow({
      dataverseUrl,
      token,
      dataflowId: entry.dataflowId,
      name: entry.name,
    });

    const result = await buildComparisonResult(entry, remote);
    results.push(result);
    if (isDetailed) {
      printDetailedResult(result);
    }
  }

  const summary = summarize(results);
  if (!isDetailed) {
    printGroupedResults(results);
  }

  console.log("");
  console.log(
    `Summary: ${summary.inSync} in sync, ${summary.differs} differ, ${summary.localMissing} missing locally, ${summary.remoteMissing} missing remotely`,
  );

  if (
    summary.differs > 0 ||
    summary.localMissing > 0 ||
    summary.remoteMissing > 0
  ) {
    process.exitCode = 1;
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

function printHelp() {
  console.log(`Usage:
  node ./scripts/check-dataflows.mjs
  node ./scripts/check-dataflows.mjs 00-stage-system-intakes.m
  node ./scripts/check-dataflows.mjs --file 00-stage-system-intakes.m

Options:
  --file <relativePath>   Check only one manifest entry. Repeatable.
  --manifest <path>       Path to the manifest file. Defaults to ${DEFAULT_DATAFLOW_MANIFEST}
  --help                  Show this help message.
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

async function buildComparisonResult(entry, remote) {
  if (!remote) {
    return {
      ...baseResult(entry),
      status: "REMOTE_MISSING",
      guidance: "Review the manifest dataflowId/name.",
    };
  }

  const remoteContent = normalizeMashupDocument(remote.msdyn_mashupdocument);
  const remoteHash = hashContent(remoteContent);
  const remoteModified = remote.modifiedon ? new Date(remote.modifiedon) : null;
  const remoteModifiedBy = getModifiedBy(remote);

  if (!existsSync(entry.absolutePath)) {
    return {
      ...baseResult(entry),
      status: "LOCAL_MISSING",
      guidance: "Run dataflows:pull to write the Dataflow mashup document locally.",
      remoteHash,
      remoteModified,
      remoteModifiedBy,
    };
  }

  const localStat = await stat(entry.absolutePath);
  const localContent = normalizeMashupDocument(
    readFileSync(entry.absolutePath, "utf8"),
  );
  const localHash = hashContent(localContent);
  const inSync = localContent === remoteContent;

  return {
    ...baseResult(entry),
    status: inSync ? "IN_SYNC" : "DIFFERS",
    guidance: inSync
      ? "Local file matches the Dataverse mashup document."
      : "Local file differs from Dataverse. Pull or review before relying on the local copy.",
    localHash,
    localModified: localStat.mtime,
    remoteHash,
    remoteModified,
    remoteModifiedBy,
  };
}

function baseResult(entry) {
  return {
    file: entry.file,
    name: entry.name || null,
    dataflowId: entry.dataflowId || null,
    localHash: null,
    localModified: null,
    remoteHash: null,
    remoteModified: null,
    remoteModifiedBy: null,
  };
}

function summarize(results) {
  return {
    inSync: results.filter((result) => result.status === "IN_SYNC").length,
    differs: results.filter((result) => result.status === "DIFFERS").length,
    localMissing: results.filter((result) => result.status === "LOCAL_MISSING")
      .length,
    remoteMissing: results.filter((result) => result.status === "REMOTE_MISSING")
      .length,
  };
}

function printDetailedResult(result) {
  console.log("");
  console.log(`${result.file}`);
  console.log(`status: ${result.status}`);
  if (result.name) {
    console.log(`dataflow: ${result.name}`);
  }
  if (result.dataflowId) {
    console.log(`dataflow id: ${result.dataflowId}`);
  }
  console.log(`local hash: ${result.localHash || "missing"}`);
  if (result.localModified) {
    console.log(`local modified: ${result.localModified.toISOString()}`);
  }
  console.log(`remote hash: ${result.remoteHash || "missing"}`);
  if (result.remoteModified) {
    console.log(`remote modified: ${result.remoteModified.toISOString()}`);
  }
  if (result.remoteModifiedBy) {
    console.log(`remote modified by: ${result.remoteModifiedBy}`);
  }
  console.log(`next step: ${result.guidance}`);
}

function printGroupedResults(results) {
  const groups = ["IN_SYNC", "DIFFERS", "LOCAL_MISSING", "REMOTE_MISSING"];

  for (const status of groups) {
    const group = results.filter((result) => result.status === status);
    if (group.length === 0) {
      continue;
    }

    console.log("");
    console.log(status);
    for (const result of group) {
      const label = result.name ? `${result.file} (${result.name})` : result.file;
      console.log(`- ${label}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
