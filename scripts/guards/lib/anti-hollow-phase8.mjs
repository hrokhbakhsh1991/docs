#!/usr/bin/env node
/**
 * Phase 8 — anti-hollow prose scanner for docs/phase-8 markdown and YAML.
 * Detects placeholder language and empty markdown table rows.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");

const FAIL_PREFIX = "FAIL P8-GUARD-HOLLOW:";

const SCANNED_EXTENSIONS = new Set([".md", ".yaml", ".yml"]);

/** @type {readonly { re: RegExp; label: string }[]} */
const HOLLOW_PATTERNS = Object.freeze([
  { re: /\bTODO\b/, label: "TODO" },
  { re: /\bFIXME\b/, label: "FIXME" },
  { re: /\bTBD\b/i, label: "TBD" },
  { re: /\binsert here\b/i, label: "insert here" },
  { re: /\bplaceholder\b/i, label: "placeholder" },
]);

/**
 * @param {string} line
 * @returns {boolean}
 */
function isAntiHollowMetaRow(line) {
  const t = line.trimStart();
  return (
    /^\|\s*AH-8\.\d/.test(t) ||
    /^\|\s*\*\*ERIP-006\*\*/.test(t) ||
    /^\|\s*\*\*No boilerplate\*\*/.test(t) ||
    /^\|\s*Admin bypass comment/.test(t)
  );
}

/**
 * @param {string} line
 * @returns {string}
 */
function sanitizeLineForHollowScan(line) {
  if (isAntiHollowMetaRow(line)) {
    return "";
  }

  let s = line;
  s = s.replace(/`[^`]*`/g, "");
  s = s.replace(/'[^']*'/g, "");
  s = s.replace(/"[^"]*"/g, "");
  return s;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isMarkdownTableSeparatorRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return false;
  }
  const cells = trimmed
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isEmptyMarkdownTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return false;
  }
  if (isMarkdownTableSeparatorRow(trimmed)) {
    return false;
  }
  const cells = trimmed
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
  return cells.length > 0 && cells.every((c) => c.length === 0);
}

/**
 * @param {string} relPath
 * @param {string} content
 * @returns {{ line: number; lineContent: string; reason: string } | null}
 */
function findFirstHollowViolation(relPath, content) {
  const lines = content.split(/\r?\n/);
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNumber = i + 1;
    const trimmed = rawLine.trim();

    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }

    if (isEmptyMarkdownTableRow(rawLine)) {
      return {
        line: lineNumber,
        lineContent: rawLine,
        reason: "empty markdown table row",
      };
    }

    const sanitized = sanitizeLineForHollowScan(rawLine);
    if (sanitized.length === 0) {
      continue;
    }

    for (const { re, label } of HOLLOW_PATTERNS) {
      if (re.test(sanitized)) {
        return {
          line: lineNumber,
          lineContent: rawLine,
          reason: `forbidden token "${label}"`,
        };
      }
    }
  }

  return null;
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function collectMarkdownAndYamlFiles(dir) {
  /** @type {string[]} */
  const files = [];

  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (cause) {
      const err = cause instanceof Error ? cause : new Error(String(cause));
      throw new Error(`${FAIL_PREFIX} Cannot read directory ${current}: ${err.message}`);
    }

    for (const ent of entries) {
      const abs = path.join(current, ent.name);
      if (ent.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!ent.isFile()) {
        continue;
      }
      const ext = path.extname(ent.name).toLowerCase();
      if (SCANNED_EXTENSIONS.has(ext)) {
        files.push(abs);
      }
    }
  }

  await walk(dir);
  files.sort();
  return files;
}

/**
 * @param {string} directoryPath — absolute or repo-relative path to `docs/phase-8`
 * @returns {Promise<void>}
 */
export async function verifyAntiHollow(directoryPath) {
  if (typeof directoryPath !== "string" || directoryPath.trim().length === 0) {
    throw new Error(`${FAIL_PREFIX} directoryPath must be a non-empty string`);
  }

  const resolvedDir = path.isAbsolute(directoryPath)
    ? path.normalize(directoryPath)
    : path.normalize(path.join(REPO_ROOT, directoryPath));

  let dirStat;
  try {
    dirStat = await fs.stat(resolvedDir);
  } catch (cause) {
    const err = cause instanceof Error ? cause : new Error(String(cause));
    throw new Error(
      `${FAIL_PREFIX} Directory not accessible at ${resolvedDir}: ${err.message}`,
    );
  }

  if (!dirStat.isDirectory()) {
    throw new Error(`${FAIL_PREFIX} directoryPath is not a directory: ${resolvedDir}`);
  }

  const expectedDir = path.normalize(path.join(REPO_ROOT, "docs/phase-8"));
  if (resolvedDir !== expectedDir) {
    throw new Error(
      `${FAIL_PREFIX} directoryPath must resolve to docs/phase-8 (got ${resolvedDir})`,
    );
  }

  const files = await collectMarkdownAndYamlFiles(resolvedDir);
  if (files.length === 0) {
    throw new Error(`${FAIL_PREFIX} No markdown or YAML files found under ${resolvedDir}`);
  }

  for (const abs of files) {
    const rel = path.relative(REPO_ROOT, abs).split(path.sep).join("/");
    let content;
    try {
      content = await fs.readFile(abs, "utf8");
    } catch (cause) {
      const err = cause instanceof Error ? cause : new Error(String(cause));
      throw new Error(`${FAIL_PREFIX} Cannot read ${rel}: ${err.message}`);
    }

    const violation = findFirstHollowViolation(rel, content);
    if (violation) {
      throw new Error(
        `${FAIL_PREFIX} Hollow text or placeholder discovered in file ${rel} at line ${violation.lineContent}`,
      );
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dirArg = process.argv[2] ?? "docs/phase-8";
  try {
    await verifyAntiHollow(dirArg);
    console.log("anti-hollow-phase8: PASS (no hollow prose in docs/phase-8)");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
