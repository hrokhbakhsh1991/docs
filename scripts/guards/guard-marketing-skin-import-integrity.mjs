#!/usr/bin/env node
/**
 * R-06 — denali marketing skin import chain integrity (no orphan partials).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ENTRY = path.join(
  REPO_ROOT,
  "packages/workspaces/denali/theme/denali-marketing.css"
);
const COMPONENTS = path.join(REPO_ROOT, "packages/workspaces/denali/theme/marketing/components");
/** Cap tracks numbered Denali marketing partials through `37-mkt-login-modal.css` (36 files). */
const MAX_PARTIALS = 37;

/** @type {string[]} */
const violations = [];

if (!existsSync(ENTRY)) {
  console.error("guard-marketing-skin-import-integrity: FAIL — denali-marketing.css missing");
  process.exit(1);
}

const entry = readFileSync(ENTRY, "utf8");
const entryDir = path.dirname(ENTRY);

for (const match of entry.matchAll(/@import\s+["']\.\/([^"']+)["']/g)) {
  const imported = path.join(entryDir, match[1]);
  if (!existsSync(imported)) {
    violations.push(`denali-marketing.css imports missing file: ${match[1]}`);
  }
}

if (existsSync(COMPONENTS)) {
  const partials = readdirSync(COMPONENTS).filter((f) => f.endsWith(".css"));
  if (partials.length > MAX_PARTIALS) {
    violations.push(`denali marketing has ${partials.length} partials (max ${MAX_PARTIALS})`);
  }

  const importedNames = new Set(
    [...entry.matchAll(/components\/([^"']+\.css)/g)].map((m) => m[1])
  );
  for (const file of partials) {
    if (!importedNames.has(file)) {
      violations.push(`orphan partial not imported: marketing/components/${file}`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-marketing-skin-import-integrity: FAIL");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-marketing-skin-import-integrity: PASS");
