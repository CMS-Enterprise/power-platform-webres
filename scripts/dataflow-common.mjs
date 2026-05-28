import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const DEFAULT_DATAFLOW_MANIFEST =
  "./apps/it-governance/migrations/dataflows.manifest.json";

export function loadEnv(envPath) {
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

export function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function validateDataverseEnv(env) {
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
}

export async function getAccessToken(env, dataverseUrl) {
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

export async function dataverseRequest({
  dataverseUrl,
  token,
  path: requestPath,
  method = "GET",
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

export async function listDataflows({ dataverseUrl, token }) {
  const requestPath = [
    "/api/data/v9.2/msdyn_dataflows",
    "?$select=msdyn_dataflowid,msdyn_name,createdon,modifiedon,_modifiedby_value,",
    "msdyn_mashupdocument,msdyn_mashupsettings,statecode,statuscode",
    ",componentstate,ismanaged",
    "&$orderby=msdyn_name asc",
  ].join("");

  const response = await dataverseRequest({
    dataverseUrl,
    token,
    path: requestPath,
  });

  return response.value || [];
}

export async function findDataflow({ dataverseUrl, token, dataflowId, name }) {
  if (dataflowId) {
    const requestPath = [
      `/api/data/v9.2/msdyn_dataflows(${sanitizeGuid(dataflowId)})`,
      "?$select=msdyn_dataflowid,msdyn_name,createdon,modifiedon,_modifiedby_value,",
      "msdyn_mashupdocument,msdyn_mashupsettings,statecode,statuscode",
      ",componentstate,ismanaged",
    ].join("");

    return dataverseRequest({ dataverseUrl, token, path: requestPath });
  }

  if (!name) {
    throw new Error("Dataflow manifest entries must include name or dataflowId.");
  }

  const filter = encodeURIComponent(
    `msdyn_name eq '${name.replaceAll("'", "''")}'`,
  );
  const requestPath = [
    "/api/data/v9.2/msdyn_dataflows",
    "?$select=msdyn_dataflowid,msdyn_name,createdon,modifiedon,_modifiedby_value,",
    "msdyn_mashupdocument,msdyn_mashupsettings,statecode,statuscode",
    ",componentstate,ismanaged",
    `&$filter=${filter}`,
  ].join("");

  const response = await dataverseRequest({
    dataverseUrl,
    token,
    path: requestPath,
  });

  if ((response.value || []).length > 1) {
    throw new Error(
      `Multiple dataflows matched '${name}'. Use dataflowId in the manifest.`,
    );
  }

  return response.value?.[0] ?? null;
}

export function normalizeRelativePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.?\//, "");
}

export function hashContent(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function normalizeMashupDocument(value) {
  return (value || "").replace(/\r\n/g, "\n");
}

export function sanitizeGuid(id) {
  return (id || "").replace(/[{}]/g, "");
}

export function resolveManifestPath(repoRoot, manifestPath) {
  return path.resolve(repoRoot, manifestPath || DEFAULT_DATAFLOW_MANIFEST);
}

export function getModifiedBy(record) {
  return (
    record["_modifiedby_value@OData.Community.Display.V1.FormattedValue"] ||
    record._modifiedby_value ||
    null
  );
}
