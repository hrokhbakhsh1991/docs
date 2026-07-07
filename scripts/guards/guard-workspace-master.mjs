#!/usr/bin/env node
/**
 * MKT-5 — every guest workspace package must ship design-language/MASTER.md.
 */
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACES_DIR = path.join(REPO_ROOT, "packages/workspaces");

/** Workspaces that must have MASTER.md (production + smoke). Starter excluded — template only. */
const REQUIRED = new Set(["denali", "urban", "guest-club"]);

/** @type {string[]} */
const violations = [];

for (const entry of readdirSync(WORKSPACES_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (!REQUIRED.has(entry.name)) continue;

  const masterPath = path.join(WORKSPACES_DIR, entry.name, "design-language", "MASTER.md");
  if (!existsSync(masterPath)) {
    violations.push(`${entry.name}: missing design-language/MASTER.md`);
  }
}

const denaliCanonical = path.join(
  REPO_ROOT,
  "packages/workspaces/denali/design-language/MASTER.md"
);
if (!existsSync(denaliCanonical)) {
  violations.push("denali: canonical MASTER.md missing in workspace package");
}

if (violations.length > 0) {
  console.error("guard-workspace-master: FAIL");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("guard-workspace-master: PASS");
