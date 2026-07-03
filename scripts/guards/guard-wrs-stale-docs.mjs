#!/usr/bin/env node
/**
 * WRS-001 — assert stale shop.operator defaults are not documented as canonical.
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const DOC_CHECKS = [
  {
    rel: "docs/workspaces/denali/marketing-catalog-ui.md",
    forbidden: ["Default Playwright base URLs: operator `http://shop.operator"],
  },
  {
    rel: "apps/marketing/playwright.marketing.config.ts",
    forbidden: ["shop.operator.localhost"],
  },
];

const violations = [];

for (const { rel, forbidden } of DOC_CHECKS) {
  const abs = path.join(REPO_ROOT, rel);
  if (!statSync(abs, { throwIfNoEntry: false })) {
    continue;
  }
  const content = readFileSync(abs, "utf8");
  for (const needle of forbidden) {
    if (content.includes(needle)) {
      violations.push(`${rel}: contains stale canonical reference "${needle}"`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-wrs-stale-docs: FAIL");
  for (const v of violations) {
    console.error(` - ${v}`);
  }
  process.exit(1);
}

console.log("guard-wrs-stale-docs: PASS");
