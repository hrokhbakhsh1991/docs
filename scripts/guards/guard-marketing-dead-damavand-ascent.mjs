#!/usr/bin/env node
/**
 * MKT-DEAD-02 — unused Damavand ascent experiment must not ship in marketing home.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HOME = path.join(REPO_ROOT, "apps/marketing/src/home");

/** @type {string[]} */
const FORBIDDEN = [
  "home-damavand-ascent-stage.tsx",
  "home-damavand-ascent-mountain.tsx",
  "home-damavand-ascent-waypoint-ids.ts",
  "home-destination-ids.ts",
];

/** @type {string[]} */
const violations = [];

for (const file of FORBIDDEN) {
  if (existsSync(path.join(HOME, file))) {
    violations.push(file);
  }
}

if (violations.length > 0) {
  console.error("guard-marketing-dead-damavand-ascent: FAIL");
  for (const file of violations) {
    console.error(`  apps/marketing/src/home/${file} must be removed`);
  }
  process.exit(1);
}

console.log("guard-marketing-dead-damavand-ascent: PASS");
