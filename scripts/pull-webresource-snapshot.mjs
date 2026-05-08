#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
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

  validateConfig({ env, manifest, resources: args.resources });

  const resourceRoot = path.resolve(repoRoot, manifest.resourceRoot);
  const resources = await buildResourcePlan({
    manifest,
    resourceRoot,
    filterFiles: args.resources
  });

  if (resources.length === 0) {
    throw new Error("No manifest resources matched the provided filters.");
  }

  const dataverseUrl = env.DATAVERSE_URL.replace(/\/$/, "");
  const token = await getAccessToken(env, dataverseUrl);

  for (const resource of resources) {
    const remote = await findExistingWebResource({
      dataverseUrl,
      token,
      name: resource.name
    });

    if (!remote) {
      throw new Error(`Web resource '${resource.name}' was not found in Dataverse.`);
    }

    const snapshotPath = buildSnapshotPath(resource.absolutePath);
    const remoteBuffer = Buffer.from(remote.content || "", "base64");
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, remoteBuffer);

    console.log(`${resource.file}`);
    console.log(`web resource: ${resource.name}`);
    console.log(`snapshot: ${path.relative(repoRoot, snapshotPath)}`);
    if (remote.modifiedon) {
      console.log(`remote modified: ${new Date(remote.modifiedon).toISOString()}`);
    }
    const modifiedBy =
      remote["_modifiedby_value@OData.Community.Display.V1.FormattedValue"] ||
      remote._modifiedby_value;
    if (modifiedBy) {
      console.log(`remote modified by: ${modifiedBy}`);
    }

    if (args.diff) {
      console.log("Running diff against local file...");
      runDiff(resource.file, repoRoot);
    }

    console.log("");
  }
}

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    diff: false,
    resources: []
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

    if (current === "--diff") {
      args.diff = true;
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
  node ./scripts/pull-webresource-snapshot.mjs html/example.html
  node ./scripts/pull-webresource-snapshot.mjs --resource html/example.html

Options:
  --diff                    After pulling the snapshot, immediately run a diff against the local file.
  --resource <relativePath> Pull a remote snapshot for a specific manifest entry. Repeatable.
  --manifest <path>         Path to the manifest file. Defaults to ${DEFAULT_MANIFEST}
  --help                    Show this help message.

Behavior:
  Writes a sibling snapshot file like html/example.remote.html without modifying the local source file.
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

function validateConfig({ env, manifest, resources }) {
  const requiredEnv = ["TENANT_ID", "CLIENT_ID", "CLIENT_SECRET", "DATAVERSE_URL"];
  const missingEnv = requiredEnv.filter((name) => !env[name]);

  if (missingEnv.length > 0) {
    throw new Error(`Missing required environment values: ${missingEnv.join(", ")}`);
  }

  if (!manifest.resourceRoot) {
    throw new Error("Manifest must define resourceRoot.");
  }

  if (!Array.isArray(manifest.resources) || manifest.resources.length === 0) {
    throw new Error("Manifest resources must be a non-empty array.");
  }

  if (resources.length === 0) {
    throw new Error("Provide at least one resource path to pull a remote snapshot.");
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
    if (!filters.has(file)) {
      continue;
    }

    const absolutePath = path.resolve(resourceRoot, file);
    await stat(absolutePath);
    const name = resolveWebResourceName({
      entry,
      file,
      nameTemplate: manifest.nameTemplate
    });

    matched.push({
      absolutePath,
      file,
      name
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
      `Manifest entry '${file}' is missing a name, and the manifest does not define nameTemplate.`
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
    scope
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to acquire access token: ${response.status} ${errorText}`);
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
    `&$filter=${filter}`
  ].join("");

  const response = await dataverseRequest({
    dataverseUrl,
    token,
    path: requestPath,
    method: "GET"
  });

  return response.value?.[0] ?? null;
}

async function dataverseRequest({ dataverseUrl, token, path: requestPath, method }) {
  const response = await fetch(`${dataverseUrl}${requestPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
      "OData-Version": "4.0",
      "OData-MaxVersion": "4.0"
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dataverse request failed (${method} ${requestPath}): ${response.status} ${errorText}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function buildSnapshotPath(absolutePath) {
  const extension = path.extname(absolutePath);
  const base = absolutePath.slice(0, absolutePath.length - extension.length);
  return `${base}.remote${extension}`;
}

function normalizeRelativePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.?\//, "");
}

function runDiff(resource, repoRoot) {
  const localPath = path.resolve(
    repoRoot,
    "apps/it-governance/web-resources",
    normalizeRelativePath(resource)
  );
  const remotePath = buildSnapshotPath(localPath);

  const result = spawnSync("diff", ["-u", remotePath, localPath], {
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status === 0) {
    console.log("No differences.");
  } else if (result.status !== 1) {
    process.exitCode = result.status ?? 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
