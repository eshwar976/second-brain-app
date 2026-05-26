#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_PATHS = [
  ".agents/skills"
];

const vaultPath = process.argv[2];
const configuredPaths = process.argv[3]
  ? process.argv[3].split(",").map((item) => item.trim()).filter(Boolean)
  : DEFAULT_PATHS;

const MAX_ERROR_LOGS = 12;
const READ_RETRIES = 2;
const RETRY_DELAY_MS = 350;
const BRCTL_BIN = "/usr/bin/brctl";
const FILEPROVIDERCTL_BIN = "/usr/bin/fileproviderctl";

if (!vaultPath) {
  console.error("hydrate-vault-paths: missing vault path");
  process.exit(2);
}

let filesSeen = 0;
let filesRead = 0;
let dirsSeen = 0;
let errors = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMarkdown(filePath) {
  return filePath.toLowerCase().endsWith(".md");
}

function logReadError(relativePath, error) {
  errors += 1;
  if (errors <= MAX_ERROR_LOGS) {
    console.error(`hydrate-vault-paths: skipped ${relativePath}: ${error.message}`);
  } else if (errors === MAX_ERROR_LOGS + 1) {
    console.error("hydrate-vault-paths: additional read errors suppressed");
  }
}

async function readFileWithRetry(filePath, relativePath) {
  filesSeen += 1;
  for (let attempt = 1; attempt <= READ_RETRIES; attempt += 1) {
    try {
      await fs.readFile(filePath, "utf8");
      filesRead += 1;
      return;
    } catch (error) {
      if (attempt === 1) requestICloudDownload(filePath);
      if (attempt === READ_RETRIES) {
        logReadError(relativePath, error);
        return;
      }
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
}

async function hydratePath(relativePath) {
  const absolutePath = path.join(vaultPath, relativePath);
  let stat;
  try {
    stat = await fs.stat(absolutePath);
  } catch (error) {
    logReadError(relativePath, error);
    return;
  }

  if (stat.isDirectory()) {
    requestICloudDownload(absolutePath);
    dirsSeen += 1;
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      if (entry.name.startsWith(".")) return;
      const childRelative = path.join(relativePath, entry.name);
      if (entry.isDirectory()) {
        await hydratePath(childRelative);
        return;
      }
      if (entry.isFile() && isMarkdown(entry.name)) {
        await readFileWithRetry(path.join(vaultPath, childRelative), childRelative);
      }
    }));
    return;
  }

  if (stat.isFile()) {
    await readFileWithRetry(absolutePath, relativePath);
  }
}

function requestICloudDownload(filePath) {
  spawnSync(BRCTL_BIN, ["download", filePath], {
    stdio: "ignore",
    timeout: 5000
  });
  spawnSync(FILEPROVIDERCTL_BIN, ["materialize", filePath], {
    stdio: "ignore",
    timeout: 8000
  });
}

for (const relativePath of configuredPaths) {
  await hydratePath(relativePath);
}

console.error(
  `hydrate-vault-paths: read ${filesRead}/${filesSeen} markdown file(s) across ${dirsSeen} folder(s); ${errors} issue(s).`
);
