#!/usr/bin/env node
/**
 * Phase 8.1 PR boundary diff — enforce PHASE-BOUNDARY-MATRIX.yaml allowed/forbidden paths.
 * @see docs/phase-8/appendices/PHASE-BOUNDARY-MATRIX.yaml
 * @see docs/phase-8/phase-8-guards.md § p8_boundary_ci_hook
 *
 * Usage:
 *   node scripts/guards/p8-boundary-diff.mjs
 *   node scripts/guards/p8-boundary-diff.mjs --files apps/api/src/urban/foo.ts
 *   P8_BOUNDARY_SUBPHASE=8.1 git diff --name-only origin/main...HEAD | xargs node scripts/guards/p8-boundary-diff.mjs --files
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const BOUNDARY_REL = "docs/phase-8/appendices/PHASE-BOUNDARY-MATRIX.yaml";
const DEFAULT_SUBPHASE = process.env.P8_BOUNDARY_SUBPHASE ?? "8.1";
const CLOSURE_SUBPHASES = new Set(["8.5", "closure"]);

/**
 * @param {string} globPattern
 * @param {string} filePath
 * @returns {boolean}
 */
function globMatch(globPattern, filePath) {
  const normalized = filePath.split(path.sep).join("/");
  let pattern = globPattern.split(path.sep).join("/");
  pattern = pattern.replace(/\*\*/g, "___GLOBSTAR___");
  pattern = pattern.replace(/\*/g, "[^/]*");
  pattern = pattern.replace(/___GLOBSTAR___/g, ".*");
  pattern = pattern.replace(/\./g, "\\.");
  pattern = pattern.replace(/\?/g, ".");
  return new RegExp(`^${pattern}$`).test(normalized);
}

/**
 * @param {string} yaml
 * @param {string} listKey
 * @returns {string[]}
 */
function parseYamlList(yaml, listKey) {
  /** @type {string[]} */
  const out = [];
  const blockRe = new RegExp(`${listKey}:\\n((?:[ \\t]+- .+\\n)+)`, "m");
  const block = blockRe.exec(yaml)?.[1];
  if (!block) {
    return out;
  }
  for (const line of block.split("\n")) {
    const m = /^\s*-\s+(.+)$/.exec(line);
    if (m) {
      out.push(m[1].trim());
    }
  }
  return out;
}

/**
 * @param {string} subphase
 * @returns {{ allowed: string[]; forbidden: string[]; extendedAllowed: string[]; extendedForbidden: string[] }}
 */
function loadBoundaryRules(subphase) {
  const raw = fs.readFileSync(path.join(REPO_ROOT, BOUNDARY_REL), "utf8");
  const subKey = subphase.replace(".", "_");
  const rulesBlock = raw.slice(raw.indexOf("rules:"), raw.indexOf("subphase_8_1_extended_boundaries:"));
  const extendedBlock = raw.slice(
    raw.indexOf("subphase_8_1_extended_boundaries:"),
    raw.indexOf("catalog_scope_metadata_mapping:"),
  );

  const allowed = parseYamlList(rulesBlock, "allowed_write_paths");
  const forbidden = parseYamlList(rulesBlock, "forbidden_write_paths");
  const extendedAllowed = parseYamlList(extendedBlock, "allowed_write_paths");
  const extendedForbidden = parseYamlList(extendedBlock, "forbidden_write_paths");

  return { allowed, forbidden, extendedAllowed, extendedForbidden };
}

/**
 * @returns {string[]}
 */
function loadClosureForbiddenPaths() {
  const raw = fs.readFileSync(path.join(REPO_ROOT, BOUNDARY_REL), "utf8");
  const block = raw.slice(raw.indexOf("subphase_8_5_closure:"));
  return parseYamlList(block, "forbidden_write_paths");
}

/**
 * @param {string} relPath
 * @param {string[]} patterns
 * @returns {boolean}
 */
function matchesAny(relPath, patterns) {
  return patterns.some((pattern) => globMatch(pattern, relPath));
}

/**
 * @returns {string[]}
 */
function resolveChangedFilesFromArgs() {
  const idx = process.argv.indexOf("--files");
  if (idx !== -1) {
    return process.argv.slice(idx + 1).filter(Boolean);
  }

  const base = process.env.P8_BOUNDARY_BASE_REF ?? "origin/main";
  const r = spawnSync("git", ["diff", "--name-only", `${base}...HEAD`], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    console.error(`p8-boundary-diff: git diff failed (${base}...HEAD) — pass --files explicitly`);
    process.exit(1);
  }
  return (r.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function runClosureMode(subphase, files) {
  const forbidden = loadClosureForbiddenPaths();
  /** @type {string[]} */
  const violations = [];

  for (const file of files) {
    const rel = file.split(path.sep).join("/");
    if (matchesAny(rel, forbidden)) {
      violations.push(`${rel} matches forbidden_write_paths (closure ${subphase})`);
    }
  }

  if (violations.length > 0) {
    console.error("p8-boundary-diff: FAIL");
    for (const v of violations) {
      console.error(`  ${v}`);
    }
    process.exit(1);
  }

  console.log(
    `p8-boundary-diff: PASS (${files.length} file(s) checked · closure mode · subphase ${subphase})`
  );
}

function runSubphase81Mode(subphase, files) {
  const { allowed, forbidden, extendedAllowed, extendedForbidden } = loadBoundaryRules(subphase);
  const allAllowed = [...allowed, ...extendedAllowed];
  const allForbidden = [...forbidden, ...extendedForbidden];

  /** @type {string[]} */
  const violations = [];

  for (const file of files) {
    const rel = file.split(path.sep).join("/");
    if (matchesAny(rel, allForbidden)) {
      violations.push(`${rel} matches forbidden_write_paths`);
      continue;
    }
    if (rel.startsWith("docs/phase-8/") || rel.startsWith("reports/phase-8-gate-")) {
      continue;
    }
    if (rel.startsWith("scripts/guards/phase-8") || rel === "scripts/guards/p8-boundary-diff.mjs") {
      continue;
    }
    const urbanTouch =
      rel.startsWith("packages/workspaces/urban/") ||
      rel === "apps/api/src/http/configure-urban-http-host.ts" ||
      rel.startsWith("apps/web/app/(app)/settings/workspace-owner/") ||
      rel.startsWith("packages/workspace-sdk/") ||
      rel.startsWith("apps/api/test/urban-") ||
      rel.startsWith("apps/web/test/urban-");
    if (!urbanTouch) {
      continue;
    }
    if (!matchesAny(rel, allAllowed)) {
      violations.push(`${rel} not in allowed_write_paths for subphase ${subphase}`);
    }
  }

  if (violations.length > 0) {
    console.error("p8-boundary-diff: FAIL");
    for (const v of violations) {
      console.error(`  ${v}`);
    }
    process.exit(1);
  }

  console.log(`p8-boundary-diff: PASS (${files.length} file(s) checked · subphase ${subphase})`);
}

function main() {
  const subphase = DEFAULT_SUBPHASE;
  const files = resolveChangedFilesFromArgs();
  if (files.length === 0) {
    console.log("p8-boundary-diff: PASS (no changed files)");
    process.exit(0);
  }

  if (CLOSURE_SUBPHASES.has(subphase)) {
    runClosureMode(subphase, files);
    return;
  }

  if (subphase !== "8.1") {
    console.log(`p8-boundary-diff: SKIP — unknown subphase ${subphase} (use 8.1 or 8.5)`);
    process.exit(0);
  }

  runSubphase81Mode(subphase, files);
}

main();
