#!/usr/bin/env node
/**
 * SEO-3 — guest SEO E2E hook manifest must reference existing specs/commands.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HOOKS_PATH = path.join(REPO_ROOT, "docs/dev/guest-seo-e2e-hooks.yaml");

/** @type {string[]} */
const violations = [];

if (!fs.existsSync(HOOKS_PATH)) {
  console.error("guard-guest-seo-e2e-hooks: FAIL — docs/dev/guest-seo-e2e-hooks.yaml missing");
  process.exit(1);
}

const raw = fs.readFileSync(HOOKS_PATH, "utf8");
const hookBlocks = [...raw.matchAll(/- id: ([^\n]+)\n(?:.*\n)*?    spec: ([^\n]+)/g)];

if (hookBlocks.length === 0) {
  violations.push("guest-seo-e2e-hooks.yaml: no hooks parsed");
}

for (const [, id, specRel] of hookBlocks) {
  const specPath = path.join(REPO_ROOT, specRel.trim());
  if (!fs.existsSync(specPath)) {
    violations.push(`${id.trim()}: spec missing at ${specRel.trim()}`);
  }
}

if (violations.length > 0) {
  console.error("guard-guest-seo-e2e-hooks: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log(`guard-guest-seo-e2e-hooks: PASS (${hookBlocks.length} hook(s))`);
