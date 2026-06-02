#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_INPUT =
  "apps/it-governance/migrations/easi-dev-data/system_intake_systems.csv";
const TARGET_COLUMN = "system_id";

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
    const result = await processFile(inputPath, outputPath, args);
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
    args.inputs.push(DEFAULT_INPUT);
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/clean-system-intake-systems-csv.mjs
  node ./scripts/clean-system-intake-systems-csv.mjs path/to/system_intake_systems.csv
  node ./scripts/clean-system-intake-systems-csv.mjs dev.csv uat.csv -o cleaned/

Options:
  -o, --output-dir <dir>  Directory for cleaned files. Defaults to <name>_cleaned.csv next to input.
  --in-place             Overwrite input files instead of writing new paths.
  -n, --dry-run          Report changes without writing files.
  -v, --verbose          Print per-row fix details.
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
  const rawCsv = await readFile(inputPath, "utf8");
  const { content, finalNewline } = splitFinalNewline(rawCsv);
  const lines = content.split(/\r?\n/);
  const newline = rawCsv.includes("\r\n") ? "\r\n" : "\n";

  if (lines.length === 0 || lines[0] === "") {
    throw new Error(`${inputPath}: expected a CSV header row`);
  }

  const header = parseCsvLine(lines[0]).map((field) => field.value);
  const targetIndex = header.indexOf(TARGET_COLUMN);
  if (targetIndex === -1) {
    throw new Error(`${inputPath}: expected a ${TARGET_COLUMN} column`);
  }

  const cleanedLines = [lines[0]];
  const changes = [];

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === "") {
      cleanedLines.push(line);
      continue;
    }

    const fields = parseCsvLine(line);
    if (fields.length !== header.length) {
      throw new Error(
        `${inputPath}: row ${index + 1} has ${fields.length} column(s); expected ${header.length}`,
      );
    }

    const originalValue = fields[targetIndex].value;
    const cleanedValue = cleanSystemId(originalValue);

    if (cleanedValue !== originalValue) {
      fields[targetIndex] = {
        ...fields[targetIndex],
        raw: formatCsvField(cleanedValue, fields[targetIndex].quoted),
        value: cleanedValue,
      };
      changes.push({ row: index + 1, originalValue, cleanedValue });
    }

    cleanedLines.push(fields.map((field) => field.raw).join(","));
  }

  if (verbose || dryRun) {
    console.error(`${inputPath}:`);
    console.error(`  rows: ${Math.max(lines.length - 1, 0)}`);
    console.error(`  ${TARGET_COLUMN} values cleaned: ${changes.length}`);

    if (verbose) {
      for (const change of changes) {
        console.error(
          `  - row ${change.row}: ${change.originalValue} -> ${change.cleanedValue}`,
        );
      }
    }
  }

  if (dryRun) {
    console.error(`dry run: would write ${outputPath}`);
    return 0;
  }

  await writeCleanedCsv(outputPath, cleanedLines.join(newline), finalNewline);
  console.error(`wrote ${outputPath}`);
  return 0;
}

function splitFinalNewline(value) {
  if (value.endsWith("\r\n")) {
    return { content: value.slice(0, -2), finalNewline: "\r\n" };
  }

  if (value.endsWith("\n")) {
    return { content: value.slice(0, -1), finalNewline: "\n" };
  }

  return { content: value, finalNewline: "" };
}

function parseCsvLine(line) {
  const fields = [];
  let index = 0;

  while (index <= line.length) {
    if (line[index] === "\"") {
      const start = index;
      index += 1;
      let value = "";

      while (index < line.length) {
        const current = line[index];

        if (current === "\"" && line[index + 1] === "\"") {
          value += "\"";
          index += 2;
          continue;
        }

        if (current === "\"") {
          index += 1;
          break;
        }

        value += current;
        index += 1;
      }

      fields.push({
        quoted: true,
        raw: line.slice(start, index),
        value,
      });
    } else {
      const start = index;
      while (index < line.length && line[index] !== ",") {
        index += 1;
      }

      const raw = line.slice(start, index);
      fields.push({
        quoted: false,
        raw,
        value: raw,
      });
    }

    if (line[index] === ",") {
      index += 1;
      continue;
    }

    break;
  }

  return fields;
}

function cleanSystemId(value) {
  return value.replace(/[{}]/g, "").toUpperCase();
}

function formatCsvField(value, wasQuoted) {
  if (wasQuoted || /[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  return value;
}

async function writeCleanedCsv(filePath, content, finalNewline) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${content}${finalNewline}`, "utf8");
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

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
