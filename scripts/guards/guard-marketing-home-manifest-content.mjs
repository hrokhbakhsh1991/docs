#!/usr/bin/env node
/**
 * ADR-MKT-001 — home surfaces must read manifest-driven anchors/slugs (no Denali hardcodes).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HOME_DIR = path.join(REPO_ROOT, "apps/marketing/src/home");

/** @type {RegExp[]} */
const FORBIDDEN = [/#why-denali/, /HOME_DESTINATION_IDS/, /home-destination-ids/];

/** @type {string[]} */
const violations = [];

function walkTsx(dir) {
  /** @type {string[]} */
  const files = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      files.push(...walkTsx(full));
      continue;
    }
    if (/\.tsx?$/.test(name.name)) {
      files.push(full);
    }
  }
  return files;
}

const guestHomeSource = readFileSync(
  path.join(HOME_DIR, "guest-home-full.tsx"),
  "utf8"
);
if (!guestHomeSource.includes("landing.destinationSlugs")) {
  violations.push("guest-home-full.tsx must pass landing.destinationSlugs");
}
if (!guestHomeSource.includes("whySectionAnchor")) {
  violations.push("guest-home-full.tsx must wire whySectionAnchor from landing");
}

if (!guestHomeSource.includes("destinationImageStems")) {
  violations.push("guest-home-full.tsx must pass landing.destinationImageStems to HomeDestinations");
}

for (const file of walkTsx(HOME_DIR)) {
  const rel = path.relative(REPO_ROOT, file);
  const source = readFileSync(file, "utf8");
  for (const pattern of FORBIDDEN) {
    if (pattern.test(source)) {
      violations.push(`${rel} must not match ${pattern}`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-marketing-home-manifest-content: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-marketing-home-manifest-content: PASS");
