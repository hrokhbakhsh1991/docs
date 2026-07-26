#!/usr/bin/env node
/**
 * Denali plugin contract surface — ./plugin must export only WorkspacePlugin host entry symbols.
 * @see docs/dev/denali-plugin-encapsulation.mdoc
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PLUGIN_FILE = path.join(REPO_ROOT, "packages/workspaces/denali/src/denali.plugin.ts");

/** Allowed named exports on denali.plugin.ts (contract + theme identity). */
const ALLOWED_EXPORTS = new Set([
  "DENALI_THEME_TOKENS_STYLESHEET",
  "DENALI_THEME_ADMIN_STYLESHEET",
  "DENALI_WORKSPACE_PLUGIN_ID",
  "DENALI_WORKSPACE_TYPE",
  "createDenaliWorkspacePlugin",
  "getDenaliWorkspacePlugin",
  "getWorkspacePlugin",
]);

/**
 * @param {string} source
 * @returns {string[]}
 */
function collectNamedExports(source) {
  /** @type {Set<string>} */
  const names = new Set();

  const exportConstFn = /export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_]+)/g;
  for (const match of source.matchAll(exportConstFn)) {
    names.add(match[1]);
  }

  const exportType = /export\s+type\s+([A-Za-z0-9_]+)/g;
  for (const match of source.matchAll(exportType)) {
    names.add(match[1]);
  }

  const exportBrace = /export\s*\{([^}]+)\}/g;
  for (const block of source.matchAll(exportBrace)) {
    const clause = block[1] ?? "";
    for (const part of clause.split(",")) {
      const trimmed = part.trim();
      if (trimmed.length === 0) {
        continue;
      }
      const exportName = trimmed.split(/\s+as\s+/i).pop()?.trim();
      if (exportName !== undefined && exportName.length > 0) {
        names.add(exportName);
      }
    }
  }

  return [...names];
}

function main() {
  const source = fs.readFileSync(PLUGIN_FILE, "utf8");
  const exports = collectNamedExports(source);
  const violations = exports.filter((name) => !ALLOWED_EXPORTS.has(name));

  if (violations.length > 0) {
    console.error("guard-denali-plugin-surface: FAIL");
    console.error(`  File: ${path.relative(REPO_ROOT, PLUGIN_FILE)}`);
    console.error(`  Disallowed exports: ${violations.sort().join(", ")}`);
    console.error(`  Allowed only: ${[...ALLOWED_EXPORTS].sort().join(", ")}`);
    process.exit(1);
  }

  const missing = [...ALLOWED_EXPORTS].filter((name) => !exports.includes(name));
  if (missing.length > 0) {
    console.error("guard-denali-plugin-surface: FAIL");
    console.error(`  Missing required contract exports: ${missing.sort().join(", ")}`);
    process.exit(1);
  }

  console.log(`guard-denali-plugin-surface: PASS (${exports.length} contract exports)`);
}

main();
