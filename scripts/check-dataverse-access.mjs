#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { getAccessToken, loadEnv } from "./dataflow-common.mjs";

const REQUEST_TIMEOUT_MS = 30_000;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv(path.join(process.cwd(), ".env"));
  validateCredentials(env);

  const dataverseUrl = normalizeDataverseUrl(args.url);
  const token = await getAccessToken(
    { ...env, DATAVERSE_SCOPE: `${dataverseUrl}/.default` },
    dataverseUrl,
  );

  const checkedAt = new Date().toISOString();
  const identityResponse = await dataverseGet({
    dataverseUrl,
    token,
    path: "/api/data/v9.2/WhoAmI",
  });

  if (isDenied(identityResponse)) {
    console.error(
      `IDENTITY_DENIED: ${dataverseUrl} (${identityResponse.status})`,
    );
    console.error("WEB_RESOURCE_READ_NOT_TESTED");
    console.error(`ACCESS_DENIED: ${dataverseUrl}`);
    console.error(`Checked at: ${checkedAt}`);
    process.exitCode = 1;
    return;
  }

  await requireSuccessfulResponse(identityResponse, dataverseUrl, "WhoAmI");
  const identity = await identityResponse.json();
  console.log(`IDENTITY_RECOGNIZED: ${dataverseUrl}`);
  console.log(`Application user ID: ${identity.UserId}`);
  console.log(`Organization ID: ${identity.OrganizationId}`);

  const webResourceResponse = await dataverseGet({
    dataverseUrl,
    token,
    path: "/api/data/v9.2/webresourceset?$select=webresourceid&$top=1",
  });

  if (isDenied(webResourceResponse)) {
    console.error(
      `WEB_RESOURCE_READ_DENIED: ${dataverseUrl} (${webResourceResponse.status})`,
    );
    console.error(`ACCESS_DENIED: ${dataverseUrl}`);
    console.error(`Checked at: ${checkedAt}`);
    process.exitCode = 1;
    return;
  }

  await requireSuccessfulResponse(
    webResourceResponse,
    dataverseUrl,
    "web-resource read",
  );
  console.log(`WEB_RESOURCE_READ_GRANTED: ${dataverseUrl}`);
  console.log(`ACCESS_GRANTED: ${dataverseUrl}`);
  console.log(`Checked at: ${checkedAt}`);
}

async function dataverseGet({ dataverseUrl, token, path: requestPath }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(`${dataverseUrl}${requestPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "OData-Version": "4.0",
        "OData-MaxVersion": "4.0",
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        `ACCESS_CHECK_FAILED: ${dataverseUrl} did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isDenied(response) {
  return response.status === 401 || response.status === 403;
}

async function requireSuccessfulResponse(response, dataverseUrl, checkName) {
  if (response.ok) return;

  const errorText = await response.text();
  throw new Error(
    `ACCESS_CHECK_FAILED: ${checkName} against ${dataverseUrl} returned ${response.status} ${errorText}`,
  );
}

function parseArgs(argv) {
  let url = "";

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--url") {
      url = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (current === "--help" || current === "-h") {
      printHelp();
      process.exit(0);
    }

    if (!current.startsWith("-") && !url) {
      url = current;
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  if (!url) {
    throw new Error(
      "An explicit Dataverse environment URL is required. Use --url <url>.",
    );
  }

  return { url };
}

function normalizeDataverseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid Dataverse URL: ${value}`);
  }

  if (url.protocol !== "https:") {
    throw new Error("The Dataverse URL must use HTTPS.");
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      "Provide the Dataverse environment root URL without a path, query, or fragment.",
    );
  }

  return url.origin;
}

function validateCredentials(env) {
  const required = ["TENANT_ID", "CLIENT_ID", "CLIENT_SECRET"];
  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment values: ${missing.join(", ")}`,
    );
  }
}

function printHelp() {
  console.log(`Usage:
  npm run dataverse:access:check -- --url https://example.crm.dynamics.com

Calls Dataverse WhoAmI and performs a minimal web-resource metadata read to
test whether the service principal configured in .env is recognized and can
use the local web-resource tooling in the explicitly selected environment.
The check does not read business records or change the environment.

Exit codes:
  0  Access granted
  1  Access denied or check failed
`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
