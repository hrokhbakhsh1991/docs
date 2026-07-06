#!/usr/bin/env node
/**
 * CSS-G-02 — bootstrap CSS trees must not leak workspace styling.
 * @see docs/dev/guard-css-integrity.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findBootstrapViolations, findL2FallbackViolations, readCssImportTree } from "./css-ownership-lib.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TOKENS_SRC = path.join(REPO_ROOT, "packages/design-tokens/src");

/** @type {string[]} */
const violations = [];

/** @type {{ name: string; entry: string; forbiddenImport: string | null }[]} */
const BOOTSTRAPS = [
  {
    name: "portal-bootstrap",
    entry: path.join(TOKENS_SRC, "portal-bootstrap.css"),
    forbiddenImport: "fallback-guest-marketing-shell.css",
  },
  {
    name: "marketing-bootstrap",
    entry: path.join(TOKENS_SRC, "marketing-bootstrap.css"),
    forbiddenImport: "fallback-guest-portal-shell.css",
  },
  {
    name: "admin-bootstrap",
    entry: path.join(TOKENS_SRC, "admin-bootstrap.css"),
    forbiddenImport: null,
  },
];

for (const bootstrap of BOOTSTRAPS) {
  if (!fs.existsSync(bootstrap.entry)) {
    violations.push(`${bootstrap.name}: missing entry file`);
    continue;
  }
  const tree = readCssImportTree(REPO_ROOT, bootstrap.entry);
  for (const file of tree) {
    if (file.missing) {
      violations.push(`${bootstrap.name}: missing import ${path.relative(REPO_ROOT, file.path)}`);
      continue;
    }
    const rel = path.relative(REPO_ROOT, file.path);
    violations.push(...findBootstrapViolations(file.content, rel));
    if (
      bootstrap.forbiddenImport !== null &&
      file.content.includes(bootstrap.forbiddenImport)
    ) {
      violations.push(`${bootstrap.name}: cross-surface import ${bootstrap.forbiddenImport} in ${rel}`);
    }
  }
}


const L2_FALLBACKS = [
  path.join(TOKENS_SRC, "fallback-guest-portal-shell.css"),
  path.join(TOKENS_SRC, "fallback-guest-marketing-shell.css"),
];
for (const fallbackPath of L2_FALLBACKS) {
  if (!fs.existsSync(fallbackPath)) {
    violations.push(`missing L2 fallback ${path.relative(REPO_ROOT, fallbackPath)}`);
    continue;
  }
  const rel = path.relative(REPO_ROOT, fallbackPath);
  violations.push(
    ...findL2FallbackViolations(fs.readFileSync(fallbackPath, "utf8"), rel)
  );
}

if (violations.length > 0) {
  console.error("guard-css-bootstrap-integrity: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-css-bootstrap-integrity: PASS");
