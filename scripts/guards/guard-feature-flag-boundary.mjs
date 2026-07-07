#!/usr/bin/env node
/**
 * PF-4.3 — presentation (manifest) vs intake (plugin registry) boundary in SDK catalog layer.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SDK_CATALOG = path.join(REPO_ROOT, "packages/workspace-sdk/src/catalog");

/** @type {string[]} */
const violations = [];

function listTsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...listTsFiles(p));
    } else if (/\.tsx?$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

for (const file of listTsFiles(SDK_CATALOG)) {
  const rel = path.relative(REPO_ROOT, file);
  const source = fs.readFileSync(file, "utf8");
  if (/@app-tour\/workspace-(denali|urban|starter)/.test(source)) {
    violations.push(`${rel}: imports workspace product package from SDK catalog layer`);
  }
  if (file.endsWith("resolve-intake-schema.ts") && /catalogPresentation/.test(source)) {
    violations.push(`${rel}: must not read catalogPresentation — presentation is manifest/host concern`);
  }
  if (/resolve-catalog-list-features\.ts$/.test(file) && /resolveIntakeSchema/.test(source)) {
    violations.push(`${rel}: must not depend on intake schema resolver`);
  }
}

if (violations.length > 0) {
  console.error("guard-feature-flag-boundary: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-feature-flag-boundary: PASS");
