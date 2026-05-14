#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_MANIFEST =
  "./apps/it-governance/web-resources/webresources.manifest.json";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const env = loadEnv(path.join(repoRoot, ".env"));
  const manifestPath = path.resolve(repoRoot, args.manifest);
  const manifest = readJson(manifestPath);

  validateConfig({ args, env, manifest });

  const resourceRoot = path.resolve(repoRoot, manifest.resourceRoot);
  const resources = await buildResourcePlan({
    manifest,
    resourceRoot,
    filterFiles: args.resources,
  });

  if (resources.length === 0) {
    throw new Error("No manifest resources matched the provided filters.");
  }

  const dataverseUrl = env.DATAVERSE_URL.replace(/\/$/, "");
  const token = await getAccessToken(env, dataverseUrl);
  const isDetailed = resources.length === 1;

  console.log(
    `Checking ${resources.length} web resource(s) against ${dataverseUrl}`,
  );

  const results = [];

  for (const resource of resources) {
    const remote = await findExistingWebResource({
      dataverseUrl,
      token,
      name: resource.name,
    });

    const result = buildComparisonResult(resource, remote);
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
    `Summary: ${summary.inSync} in sync, ${summary.differs} differ, ${summary.remoteMissing} missing remotely`,
  );

  if (summary.differs > 0 || summary.remoteMissing > 0) {
    console.log("");
    console.log("Next step:");
    console.log("One or more resources differ from Dataverse.");
    console.log(
      "Review the local file against the version currently published in Power Apps before deploying.",
    );
    console.log(
      "Use this detailed single-file check for hashes, modified dates, and last-modified-by info:",
    );
    const example =
      results.find((result) => result.status !== "IN_SYNC") || results[0];
    console.log(`npm run webres:check:file -- ${example.file}`);
  }

  if (summary.differs > 0 || summary.remoteMissing > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    resources: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--manifest") {
      args.manifest = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === "--resource") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--resource requires a relative file path.");
      }
      args.resources.push(normalizeRelativePath(value));
      index += 1;
      continue;
    }

    if (current === "--help" || current === "-h") {
      printHelp();
      process.exit(0);
    }

    if (!current.startsWith("-")) {
      args.resources.push(normalizeRelativePath(current));
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/check-webresources.mjs
  node ./scripts/check-webresources.mjs html/example.html
  node ./scripts/check-webresources.mjs --resource html/example.html

Options:
  --resource <relativePath> Check only a specific manifest entry. Repeatable.
  --manifest <path>         Path to the manifest file. Defaults to ${DEFAULT_MANIFEST}
  --help                    Show this help message.

Exit codes:
  0  All checked resources are in sync.
  1  One or more resources differ or are missing remotely.
`);
}

function loadEnv(envPath) {
  const result = { ...process.env };

  if (!existsSync(envPath)) {
    return result;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = stripWrappingQuotes(rawValue);
    if (!(key in result)) {
      result[key] = value;
    }
  }

  return result;
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function validateConfig({ args, env, manifest }) {
  const requiredEnv = [
    "TENANT_ID",
    "CLIENT_ID",
    "CLIENT_SECRET",
    "DATAVERSE_URL",
  ];
  const missingEnv = requiredEnv.filter((name) => !env[name]);

  if (missingEnv.length > 0) {
    throw new Error(
      `Missing required environment values: ${missingEnv.join(", ")}`,
    );
  }

  if (!manifest.resourceRoot) {
    throw new Error("Manifest must define resourceRoot.");
  }

  if (!Array.isArray(manifest.resources) || manifest.resources.length === 0) {
    throw new Error("Manifest resources must be a non-empty array.");
  }
}

async function buildResourcePlan({ manifest, resourceRoot, filterFiles }) {
  const matched = [];
  const filters = new Set(filterFiles);

  for (const entry of manifest.resources) {
    if (!entry.file) {
      throw new Error("Each manifest resource must include a file property.");
    }

    const file = normalizeRelativePath(entry.file);
    if (filters.size > 0 && !filters.has(file)) {
      continue;
    }

    const absolutePath = path.resolve(resourceRoot, file);
    const localStat = await stat(absolutePath);
    const localBuffer = readFileSync(absolutePath);
    const name = resolveWebResourceName({
      entry,
      file,
      nameTemplate: manifest.nameTemplate,
    });

    matched.push({
      file,
      name,
      localBuffer,
      localHash: hashContent(localBuffer),
      localModified: localStat.mtime,
    });
  }

  return matched;
}

function resolveWebResourceName({ entry, file, nameTemplate }) {
  if (entry.name) {
    return entry.name;
  }

  if (!nameTemplate) {
    throw new Error(
      `Manifest entry '${file}' is missing a name, and the manifest does not define nameTemplate.`,
    );
  }

  return nameTemplate.replaceAll("{relativePath}", file);
}

async function getAccessToken(env, dataverseUrl) {
  const scope = env.DATAVERSE_SCOPE || `${dataverseUrl}/.default`;
  const tokenUrl = `https://login.microsoftonline.com/${env.TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: env.CLIENT_ID,
    client_secret: env.CLIENT_SECRET,
    grant_type: "client_credentials",
    scope,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to acquire access token: ${response.status} ${errorText}`,
    );
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error("Access token response did not include access_token.");
  }

  return payload.access_token;
}

async function findExistingWebResource({ dataverseUrl, token, name }) {
  const filter = encodeURIComponent(`name eq '${name.replaceAll("'", "''")}'`);
  const requestPath = [
    "/api/data/v9.2/webresourceset",
    "?$select=webresourceid,name,content,modifiedon,_modifiedby_value",
    `&$filter=${filter}`,
  ].join("");

  const response = await dataverseRequest({
    dataverseUrl,
    token,
    path: requestPath,
    method: "GET",
  });

  return response.value?.[0] ?? null;
}

async function dataverseRequest({
  dataverseUrl,
  token,
  path: requestPath,
  method,
}) {
  const response = await fetch(`${dataverseUrl}${requestPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      Prefer:
        'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
      "OData-Version": "4.0",
      "OData-MaxVersion": "4.0",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Dataverse request failed (${method} ${requestPath}): ${response.status} ${errorText}`,
    );
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function buildComparisonResult(resource, remote) {
  if (!remote) {
    return {
      file: resource.file,
      name: resource.name,
      status: "REMOTE_MISSING",
      guidance:
        "Review the manifest name or create the web resource before relying on updates.",
      localHash: resource.localHash,
      localModified: resource.localModified,
      remoteHash: null,
      remoteModified: null,
      remoteModifiedBy: null,
    };
  }

  const remoteBuffer = Buffer.from(remote.content || "", "base64");
  const remoteHash = hashContent(remoteBuffer);
  const inSync = remoteBuffer.equals(resource.localBuffer);

  return {
    file: resource.file,
    name: resource.name,
    status: inSync ? "IN_SYNC" : "DIFFERS",
    guidance: inSync
      ? "Safe to deploy if you intend to keep the current local content."
      : "Local and Dataverse differ. Review before publishing to avoid overwriting someone else's work.",
    localHash: resource.localHash,
    localModified: resource.localModified,
    remoteHash,
    remoteModified: remote.modifiedon ? new Date(remote.modifiedon) : null,
    remoteModifiedBy:
      remote["_modifiedby_value@OData.Community.Display.V1.FormattedValue"] ||
      remote._modifiedby_value ||
      null,
  };
}

function printDetailedResult(result) {
  console.log("");
  console.log(`${result.file}`);
  console.log(`status: ${result.status}`);
  console.log(`web resource: ${result.name}`);
  console.log(`local hash: ${result.localHash}`);
  console.log(`local modified: ${formatDate(result.localModified)}`);

  if (result.remoteHash) {
    console.log(`remote hash: ${result.remoteHash}`);
  } else {
    console.log("remote hash: missing");
  }

  if (result.remoteModified) {
    console.log(`remote modified: ${formatDate(result.remoteModified)}`);
  }

  if (result.remoteModifiedBy) {
    console.log(`remote modified by: ${result.remoteModifiedBy}`);
  }

  console.log(`next step: ${result.guidance}`);
}

function printGroupedResults(results) {
  const groups = [
    ["IN_SYNC", "IN_SYNC"],
    ["DIFFERS", "DIFFERS"],
    ["REMOTE_MISSING", "REMOTE_MISSING"],
  ];

  for (const [label, status] of groups) {
    const matches = results.filter((result) => result.status === status);
    if (matches.length === 0) {
      continue;
    }

    console.log("");
    console.log(`${label} (${matches.length})`);
    for (const result of matches) {
      console.log(`- ${result.file}`);
    }
  }
}

function summarize(results) {
  return results.reduce(
    (accumulator, result) => {
      if (result.status === "IN_SYNC") {
        accumulator.inSync += 1;
      } else if (result.status === "DIFFERS") {
        accumulator.differs += 1;
      } else if (result.status === "REMOTE_MISSING") {
        accumulator.remoteMissing += 1;
      }
      return accumulator;
    },
    { inSync: 0, differs: 0, remoteMissing: 0 },
  );
}

function hashContent(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function normalizeRelativePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.?\//, "");
}

function formatDate(value) {
  if (!value) {
    return "unknown";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return date.toISOString();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
