#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { inspect } from "node:util";

// Timestamps accidentally pasted during copy/export (any ISO-8601 UTC with fractional seconds).
const TIMESTAMP_PATTERN = /20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/g;

// Spaces left in UUIDs when a timestamp sat between hex segments (e.g. "3193C9 0E117E").
const UUID_SEGMENT_GAP =
  /(\{?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]*) ([0-9A-Fa-f]{4,}\}?)/g;
const WRAPPED_UUID =
  /^\{+([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})\}+$/;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.inPlace && args.outputDir !== null) {
    console.error("error: use either --in-place or --output-dir, not both");
    process.exitCode = 2;
    return;
  }

  let exitCode = 0;

  for (const inputPath of args.inputs) {
    if (!await isFile(inputPath)) {
      console.error(`error: not a file: ${inputPath}`);
      exitCode = Math.max(exitCode, 1);
      continue;
    }

    const outputPath = resolveOutputPath(inputPath, args.outputDir, args.inPlace);
    const result = await processFile(inputPath, outputPath, {
      dryRun: args.dryRun,
      verbose: args.verbose,
    });
    exitCode = Math.max(exitCode, result);
  }

  process.exitCode = exitCode;
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    inPlace: false,
    inputs: [],
    outputDir: null,
    verbose: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === "--help" || current === "-h") {
      printHelp();
      process.exit(0);
    }

    if (current === "--in-place") {
      args.inPlace = true;
      continue;
    }

    if (current === "--dry-run" || current === "-n") {
      args.dryRun = true;
      continue;
    }

    if (current === "--verbose" || current === "-v") {
      args.verbose = true;
      continue;
    }

    if (current === "--output-dir" || current === "-o") {
      const outputDir = argv[index + 1];
      if (!outputDir || outputDir.startsWith("-")) {
        throw new Error(`${current} requires a directory path.`);
      }
      args.outputDir = outputDir;
      index += 1;
      continue;
    }

    if (!current.startsWith("-")) {
      args.inputs.push(current);
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  if (args.inputs.length === 0) {
    throw new Error("At least one JSON input file is required.");
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/clean-cedar-systems-json.mjs path/to/systems.json
  node ./scripts/clean-cedar-systems-json.mjs impl.json prod.json -o cleaned/
  node ./scripts/clean-cedar-systems-json.mjs systems.json --in-place

Options:
  -o, --output-dir <dir>  Directory for cleaned files. Defaults to <name>_cleaned.json next to input.
  --in-place             Overwrite input files instead of writing new paths.
  -n, --dry-run          Report changes without writing files.
  -v, --verbose          Print per-field fix details.
  -h, --help             Show this help message.
`);
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function processFile(inputPath, outputPath, { dryRun, verbose }) {
  const systems = await loadSystems(inputPath);
  const cleanedSystems = [];
  let systemsWithChanges = 0;
  const allChanges = [];

  for (const [index, system] of systems.entries()) {
    const { cleaned, changes } = cleanSystemObject(system);
    cleanedSystems.push(cleaned);

    if (changes.length > 0) {
      systemsWithChanges += 1;
      const acronym = system.acronym || system.name || `index ${index}`;
      for (const change of changes) {
        allChanges.push(`${acronym}: ${change}`);
      }
    }
  }

  const remaining = audit(cleanedSystems);

  if (verbose || dryRun) {
    console.error(`${inputPath}:`);
    console.error(`  systems: ${systems.length}`);
    console.error(`  systems with fixes: ${systemsWithChanges}`);

    if (verbose && allChanges.length > 0) {
      for (const note of allChanges) {
        console.error(`  - ${note}`);
      }
    }

    if (remaining.length > 0) {
      console.error(`  remaining issues: ${remaining.length}`);
      for (const issue of remaining) {
        console.error(`    ! ${issue}`);
      }
    }
  }

  if (remaining.length > 0) {
    console.error(`error: ${inputPath} still has corruption after cleaning`);
    return 1;
  }

  if (dryRun) {
    console.error(`dry run: would write ${outputPath}`);
    return 0;
  }

  await writeSystems(outputPath, cleanedSystems);
  console.error(`wrote ${outputPath}`);
  return 0;
}

async function loadSystems(filePath) {
  const rawJson = await readFile(filePath, "utf8");
  const data = JSON.parse(rawJson);

  if (!Array.isArray(data)) {
    throw new Error(`${filePath}: expected a JSON array of system objects`);
  }

  for (const [index, item] of data.entries()) {
    if (!isPlainObject(item)) {
      throw new Error(`${filePath}: item ${index} is not an object`);
    }
  }

  return data;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanSystemObject(obj) {
  const changes = [];
  const cleaned = {};

  for (const [key, value] of Object.entries(obj)) {
    const { value: newKey, changed: keyChanged } = cleanString(key, {
      compactSpaces: true,
    });

    if (keyChanged) {
      changes.push(`key ${formatValue(key)} -> ${formatValue(newKey)}`);
    }

    let newValue = value;
    if (typeof value === "string") {
      const result = cleanString(value);
      newValue = result.value;

      if (result.changed) {
        const label = keyChanged ? `${formatValue(key)} (field)` : newKey;
        const preview = value.length <= 60 ? value : `${value.slice(0, 57)}...`;
        changes.push(`${label}: cleaned value (${formatValue(preview)})`);
      }
    }

    if (
      Object.hasOwn(cleaned, newKey) &&
      JSON.stringify(cleaned[newKey]) !== JSON.stringify(newValue)
    ) {
      throw new Error(
        `duplicate key after cleaning: ${formatValue(newKey)} ` +
          `(existing ${formatValue(cleaned[newKey])}, new ${formatValue(newValue)})`,
      );
    }

    cleaned[newKey] = newValue;
  }

  return { cleaned, changes };
}

function cleanString(value, { compactSpaces = false } = {}) {
  const original = value;
  let cleaned = value.replace(TIMESTAMP_PATTERN, "");
  let previous = null;

  while (previous !== cleaned) {
    previous = cleaned;
    cleaned = cleaned.replace(UUID_SEGMENT_GAP, "$1$2");
  }

  cleaned = cleaned.replace(/(-) +/g, "$1");
  cleaned = cleaned.replace(/ +(-)/g, "$1");
  cleaned = cleaned.replace(WRAPPED_UUID, "$1");

  if (compactSpaces) {
    cleaned = cleaned.replace(/ +/g, "");
  }

  return {
    changed: cleaned !== original,
    value: cleaned,
  };
}

function audit(data) {
  const issues = [];

  for (const [index, obj] of data.entries()) {
    for (const [key, value] of Object.entries(obj)) {
      if (hasTimestamp(key)) {
        issues.push(`[${index}] key still has timestamp: ${formatValue(key)}`);
      }

      if (typeof value === "string" && hasTimestamp(value)) {
        const system = obj.acronym || obj.name || obj.id;
        issues.push(
          `[${index}] ${system}: field ${formatValue(key)} still has timestamp`,
        );
      }
    }
  }

  return issues;
}

function hasTimestamp(value) {
  TIMESTAMP_PATTERN.lastIndex = 0;
  return TIMESTAMP_PATTERN.test(value);
}

async function writeSystems(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function resolveOutputPath(inputPath, outputDir, inPlace) {
  if (inPlace) {
    return inputPath;
  }

  if (outputDir !== null) {
    return path.join(outputDir, path.basename(inputPath));
  }

  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}_cleaned${parsed.ext}`);
}

function formatValue(value) {
  return inspect(value, { breakLength: Infinity });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
