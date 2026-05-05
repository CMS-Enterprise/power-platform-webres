#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SUPPORTED_EXTENSIONS = new Set([
  ".htm",
  ".html",
  ".css",
  ".js",
  ".xml",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".xap",
  ".xsl",
  ".xslt",
  ".ico",
  ".svg",
  ".resx"
]);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const manifestPath = path.resolve(repoRoot, args.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  if (!manifest.resourceRoot) {
    throw new Error("Manifest must define resourceRoot.");
  }

  if (!Array.isArray(manifest.resources)) {
    throw new Error("Manifest must define a resources array.");
  }

  const resourceRoot = path.resolve(repoRoot, manifest.resourceRoot);
  const localFiles = await listResourceFiles(resourceRoot);
  const existingByFile = new Map(
    manifest.resources.map((entry) => [normalizeRelativePath(entry.file), entry])
  );

  const missingFiles = localFiles.filter((file) => !existingByFile.has(file));

  if (missingFiles.length === 0) {
    console.log("Manifest is already in sync. No new files were added.");
    return;
  }

  for (const file of missingFiles) {
    const newEntry = { file };
    if (args.withNames) {
      newEntry.name = resolveNameFromTemplate(file, manifest.nameTemplate);
    }
    manifest.resources.push(newEntry);
  }

  manifest.resources.sort((left, right) =>
    normalizeRelativePath(left.file).localeCompare(normalizeRelativePath(right.file))
  );

  if (args.dryRun) {
    console.log(`Would add ${missingFiles.length} file(s) to the manifest:`);
  } else {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`Added ${missingFiles.length} file(s) to the manifest:`);
  }

  for (const file of missingFiles) {
    const suffix =
      args.withNames && manifest.nameTemplate
        ? ` -> ${resolveNameFromTemplate(file, manifest.nameTemplate)}`
        : "";
    console.log(`- ${file}${suffix}`);
  }
}

function parseArgs(argv) {
  const args = {
    manifest: "",
    dryRun: false,
    withNames: false
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

    if (current === "--with-names") {
      args.withNames = true;
      continue;
    }

    if (current === "--help" || current === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  if (!args.manifest) {
    throw new Error("You must provide --manifest.");
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/sync-webresources-manifest.mjs --manifest ./apps/it-governance/web-resources/webresources.manifest.json

Options:
  --dry-run      Preview missing files without changing the manifest.
  --with-names   Pre-fill each new entry's Dataverse name from nameTemplate.
  --manifest     Path to the manifest file.
  --help         Show this help message.
`);
}

async function listResourceFiles(resourceRoot) {
  const results = [];
  await walk(resourceRoot, "", results);
  return results.sort((left, right) => left.localeCompare(right));
}

async function walk(root, relativeDir, results) {
  const absoluteDir = path.join(root, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = normalizeRelativePath(path.posix.join(relativeDir, entry.name));
    const absolutePath = path.join(root, relativePath);

    if (entry.isDirectory()) {
      await walk(root, relativePath, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    results.push(normalizeRelativePath(path.relative(root, absolutePath)));
  }
}

function normalizeRelativePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.?\//, "");
}

function resolveNameFromTemplate(file, nameTemplate) {
  if (!nameTemplate) {
    return file;
  }

  return nameTemplate.replaceAll("{relativePath}", file);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
