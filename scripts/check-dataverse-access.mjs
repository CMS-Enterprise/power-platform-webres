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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${dataverseUrl}/api/data/v9.2/WhoAmI`, {
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

  if (response.ok) {
    const result = await response.json();
    console.log(`ACCESS_GRANTED: ${dataverseUrl}`);
    console.log(`Checked at: ${new Date().toISOString()}`);
    console.log(`Application user ID: ${result.UserId}`);
    console.log(`Organization ID: ${result.OrganizationId}`);
    return;
  }

  if (response.status === 401 || response.status === 403) {
    console.error(`ACCESS_DENIED: ${dataverseUrl} (${response.status})`);
    console.error(`Checked at: ${new Date().toISOString()}`);
    process.exitCode = 1;
    return;
  }

  const errorText = await response.text();
  throw new Error(
    `ACCESS_CHECK_FAILED: ${dataverseUrl} returned ${response.status} ${errorText}`,
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

Calls Dataverse WhoAmI to prove whether the service principal configured in
.env can access the explicitly selected environment. The check reads identity
metadata only and does not read business records or change the environment.

Exit codes:
  0  Access granted
  1  Access denied or check failed
`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
