#!/usr/bin/env node
/**
 * MKT-LANDMARK-01 — tenant routes must not nest <main> inside shell-main.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const TENANT_ROUTE_FILES = [
  "apps/marketing/src/home/guest-home-full.tsx",
  "apps/marketing/src/home/guest-home-minimal.tsx",
  "apps/marketing/app/tours/page.tsx",
  "apps/marketing/app/tours/[tourId]/page.tsx",
  "apps/marketing/app/tours/error.tsx",
  "apps/marketing/app/not-found.tsx",
  "apps/marketing/app/error.tsx",
];

/** @type {string[]} */
const violations = [];

const shell = readFileSync(
  path.join(REPO_ROOT, "apps/marketing/src/shell/marketing-shell.tsx"),
  "utf8"
);
if (!/id="main-content"/.test(shell)) {
  violations.push("marketing-shell.tsx must expose id=\"main-content\" on shell-main");
}

for (const relative of TENANT_ROUTE_FILES) {
  const source = readFileSync(path.join(REPO_ROOT, relative), "utf8");
  if (/<main\b/.test(source)) {
    violations.push(`${relative} must not use nested <main> (shell owns shell-main landmark)`);
  }
}

if (violations.length > 0) {
  console.error("guard-marketing-landmark: FAIL");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("guard-marketing-landmark: PASS");
