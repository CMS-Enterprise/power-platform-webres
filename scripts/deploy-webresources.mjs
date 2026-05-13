#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_MANIFEST =
  "./apps/it-governance/web-resources/webresources.manifest.json";
const DATAVERSE_REQUEST_TIMEOUT_MS = 60_000;

const WEB_RESOURCE_TYPES = {
  ".htm": 1,
  ".html": 1,
  ".css": 2,
  ".js": 3,
  ".xml": 4,
  ".png": 5,
  ".jpg": 6,
  ".jpeg": 6,
  ".gif": 7,
  ".xap": 8,
  ".xsl": 9,
  ".xslt": 9,
  ".ico": 10,
  ".svg": 11,
  ".resx": 12
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const env = loadEnv(path.join(repoRoot, ".env"));
  const manifestPath = path.resolve(repoRoot, args.manifest);
  const manifest = readJson(manifestPath);
  const solutionUniqueName =
    env.DATAVERSE_SOLUTION_UNIQUE_NAME || manifest.solutionUniqueName || "";

  validateConfig({
    args,
    env,
    manifest,
    solutionUniqueName
  });

  const resourceRoot = path.resolve(repoRoot, manifest.resourceRoot);
  const resources = await buildResourcePlan({
    manifest,
    manifestPath,
    resourceRoot,
    filterFiles: args.resources
  });

  if (resources.length === 0) {
    throw new Error("No manifest resources matched the provided filters.");
  }

  const dataverseUrl = env.DATAVERSE_URL.replace(/\/$/, "");

  if (args.dryRun) {
    console.log(`Dry run for ${resources.length} web resource(s):`);
  } else {
    console.log(`Deploying ${resources.length} web resource(s) to ${dataverseUrl}`);
  }

  const token = await getAccessToken(env, dataverseUrl);
  const changedResourceIds = [];

  for (const resource of resources) {
    const existing = await findExistingWebResource({
      dataverseUrl,
      token,
      name: resource.name
    });

    const mode = existing ? "update" : "create";

    if (!existing && !resource.createMissing) {
      throw new Error(
        `Web resource '${resource.name}' does not exist in Dataverse and createMissing is false.`
      );
    }

    const publishSafety = evaluatePublishSafety({
      force: args.force,
      localContentBase64: resource.contentBase64,
      remote: existing,
      repoRelativePath: resource.repoRelativePath
    });

    if (args.dryRun) {
      const safetySuffix = publishSafety.message ? ` [${publishSafety.message}]` : "";
      console.log(
        `- ${mode.toUpperCase()} ${resource.file} -> ${resource.name}${resource.publishAfterUpload ? " (publish)" : ""}${safetySuffix}`
      );
      continue;
    }

    if (!publishSafety.allowed) {
      throw new Error(buildPublishSafetyError(resource, existing, publishSafety));
    }

    const payload = {
      content: resource.contentBase64
    };

    if (!existing) {
      payload.name = resource.name;
      payload.displayname = resource.displayName || basenameWithoutExtension(resource.file);
      payload.description =
        resource.description ||
        `Managed from ${resource.file} in source control.`;
      payload.webresourcetype = resource.webResourceType;
    } else {
      if (resource.displayName) {
        payload.displayname = resource.displayName;
      }
      if (resource.description) {
        payload.description = resource.description;
      }
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "OData-Version": "4.0",
      "OData-MaxVersion": "4.0"
    };

    if (solutionUniqueName) {
      headers["MSCRM.SolutionUniqueName"] = solutionUniqueName;
    }

    let webresourceid;

    if (existing) {
      await dataverseRequest({
        dataverseUrl,
        token,
        path: `/api/data/v9.2/webresourceset(${existing.webresourceid})`,
        method: "PATCH",
        headers: {
          ...headers,
          "If-Match": "*"
        },
        body: payload
      });
      webresourceid = existing.webresourceid;
      console.log(`Updated ${resource.name}`);
    } else {
      const response = await dataverseRequest({
        dataverseUrl,
        token,
        path: "/api/data/v9.2/webresourceset",
        method: "POST",
        headers: {
          ...headers,
          Prefer: "return=representation"
        },
        body: payload
      });
      webresourceid = response.webresourceid || extractGuidFromEntityId(response.__odataEntityId);
      if (!webresourceid) {
        throw new Error(`Created '${resource.name}' but did not receive webresourceid back.`);
      }
      console.log(`Created ${resource.name}`);
    }

    if (resource.publishAfterUpload) {
      changedResourceIds.push(webresourceid);
    }
  }

  if (!args.dryRun && changedResourceIds.length > 0) {
    console.log(`Publishing ${changedResourceIds.length} web resource(s)...`);
    await publishWebResources({
      dataverseUrl,
      token,
      webResourceIds: changedResourceIds
    });
    console.log(`Published ${changedResourceIds.length} web resource(s).`);
  } else if (!args.dryRun) {
    console.log("No publish step was required.");
  }
}

function parseArgs(argv) {
  const args = {
    manifest: DEFAULT_MANIFEST,
    dryRun: false,
    force: false,
    resources: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--manifest") {
      args.manifest = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (current === "--force") {
      args.force = true;
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
  node ./scripts/deploy-webresources.mjs
  node ./scripts/deploy-webresources.mjs html/example.html
  node ./scripts/deploy-webresources.mjs --resource html/example.html

Options:
  --dry-run                 Resolve create/update actions without uploading content.
  --force                   Publish even if Dataverse does not match the file's git HEAD version.
  --resource <relativePath> Deploy only a specific manifest entry. Repeatable.
  --manifest <path>         Path to the manifest file. Defaults to ${DEFAULT_MANIFEST}
  --help                    Show this help message.
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
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function validateConfig({ args, env, manifest, solutionUniqueName }) {
  const requiredEnv = ["TENANT_ID", "CLIENT_ID", "CLIENT_SECRET", "DATAVERSE_URL"];
  const missingEnv = requiredEnv.filter((name) => !env[name]);

  if (missingEnv.length > 0) {
    throw new Error(`Missing required environment values: ${missingEnv.join(", ")}`);
  }

  if (!manifest.resourceRoot) {
    throw new Error("Manifest must define resourceRoot.");
  }

  if (!Array.isArray(manifest.resources)) {
    throw new Error("Manifest resources must be a non-empty array.");
  }

  if (manifest.resources.length === 0) {
    throw new Error("Manifest resources must be a non-empty array.");
  }

  if (!solutionUniqueName) {
    throw new Error(
      "Set DATAVERSE_SOLUTION_UNIQUE_NAME in .env or solutionUniqueName in the manifest."
    );
  }
}

async function buildResourcePlan({ manifest, manifestPath, resourceRoot, filterFiles }) {
  if (!Array.isArray(manifest.resources) || manifest.resources.length === 0) {
    throw new Error("Manifest resources must be a non-empty array.");
  }

  const manifestDir = path.dirname(manifestPath);
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
    await stat(absolutePath);

    const extension = path.extname(file).toLowerCase();
    const webResourceType = WEB_RESOURCE_TYPES[extension];
    if (!webResourceType) {
      throw new Error(`Unsupported web resource file type '${extension}' for ${file}`);
    }

    const name = resolveWebResourceName({
      entry,
      file,
      nameTemplate: manifest.nameTemplate
    });

    const fileBuffer = readFileSync(absolutePath);

    matched.push({
      absolutePath,
      createMissing: entry.createMissing ?? manifest.defaultCreateMissing ?? false,
      description: entry.description,
      displayName: entry.displayName,
      file,
      manifestDir,
      name,
      publishAfterUpload: entry.publishAfterUpload ?? manifest.defaultPublishAfterUpload ?? true,
      repoRelativePath: normalizeRelativePath(path.relative(process.cwd(), absolutePath)),
      webResourceType,
      contentBase64: fileBuffer.toString("base64")
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
  const requestPath =
    `/api/data/v9.2/webresourceset?$select=webresourceid,name,webresourcetype,content,modifiedon,_modifiedby_value&$filter=${filter}`;
  const response = await dataverseRequest({
    dataverseUrl,
    token,
    path: requestPath,
    method: "GET"
  });

  return response.value?.[0] ?? null;
}

async function publishWebResources({ dataverseUrl, token, webResourceIds }) {
  const xml = [
    "<importexportxml>",
    "<webresources>",
    ...webResourceIds.map((id) => `<webresource>${escapeXml(id)}</webresource>`),
    "</webresources>",
    "</importexportxml>"
  ].join("");

  await dataverseRequest({
    dataverseUrl,
    token,
    path: "/api/data/v9.2/PublishXml",
    method: "POST",
    operationName: "publish web resources",
    body: {
      ParameterXml: xml
    }
  });
}

async function dataverseRequest({
  dataverseUrl,
  token,
  path: requestPath,
  method,
  headers = {},
  body,
  operationName
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DATAVERSE_REQUEST_TIMEOUT_MS);

  let response;

  try {
    response = await fetch(`${dataverseUrl}${requestPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        "OData-Version": "4.0",
        "OData-MaxVersion": "4.0",
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      const target = operationName || `${method} ${requestPath}`;
      throw new Error(
        `Dataverse request timed out after ${DATAVERSE_REQUEST_TIMEOUT_MS / 1000}s while trying to ${target}.`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dataverse request failed (${method} ${requestPath}): ${response.status} ${errorText}`);
  }

  if (response.status === 204) {
    return {
      __odataEntityId: response.headers.get("OData-EntityId")
    };
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  payload.__odataEntityId = response.headers.get("OData-EntityId");
  return payload;
}

function normalizeRelativePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.?\//, "");
}

function basenameWithoutExtension(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function extractGuidFromEntityId(entityId) {
  if (!entityId) {
    return "";
  }

  const match = entityId.match(/\(([0-9a-fA-F-]{36})\)$/);
  return match ? match[1] : "";
}

function evaluatePublishSafety({ force, localContentBase64, remote, repoRelativePath }) {
  if (force || !remote) {
    return {
      allowed: true,
      message: force ? "force enabled" : ""
    };
  }

  const headContentBase64 = getGitHeadContentBase64(repoRelativePath);
  if (headContentBase64 === null) {
    if (remote.content === localContentBase64) {
      return {
        allowed: true,
        message: "not tracked in git, but already matches Dataverse"
      };
    }

    return {
      allowed: false,
      message: "remote differs and no git HEAD baseline is available"
    };
  }

  if (remote.content === headContentBase64) {
    return {
      allowed: true,
      message: "Dataverse matches git HEAD"
    };
  }

  if (remote.content === localContentBase64) {
    return {
      allowed: true,
      message: "Dataverse already matches local"
    };
  }

  return {
    allowed: false,
    message: "Dataverse differs from git HEAD"
  };
}

function getGitHeadContentBase64(repoRelativePath) {
  const result = spawnSync("git", ["show", `HEAD:${repoRelativePath}`], {
    cwd: process.cwd(),
    encoding: "buffer"
  });

  if (result.status !== 0) {
    return null;
  }

  return Buffer.from(result.stdout).toString("base64");
}

function buildPublishSafetyError(resource, remote, publishSafety) {
  const remoteModified = remote?.modifiedon
    ? new Date(remote.modifiedon).toISOString()
    : "unknown";
  const remoteModifiedBy =
    remote?.["_modifiedby_value@OData.Community.Display.V1.FormattedValue"] ||
    remote?._modifiedby_value ||
    "unknown";

  return [
    `Blocked publish for '${resource.file}' because ${publishSafety.message}.`,
    `Dataverse web resource: ${resource.name}`,
    `Remote modified: ${remoteModified}`,
    `Remote modified by: ${remoteModifiedBy}`,
    "Review the local file against the currently published version first:",
    `  npm run webres:check:file -- ${resource.file}`,
    `  npm run webres:pull:file -- ${resource.file}`,
    `  npm run webres:diff:file -- ${resource.file}`,
    "If you intentionally want to overwrite Dataverse, rerun with --force."
  ].join("\n");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
