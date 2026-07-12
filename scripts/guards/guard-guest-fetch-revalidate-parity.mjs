#!/usr/bin/env node
/**
 * G-BOOT-05 / M7.1 — M+P guest bootstrap + branding fetch stay on shared revalidate helpers.
 * @see docs/workspaces/denali/public-catalog.md § Production tenant bootstrap (M7.1)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

function read(rel) {
  return readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function assertMatch(rel, pattern, message) {
  const source = read(rel);
  if (!pattern.test(source)) {
    violations.push(`${rel}: ${message}`);
  }
}

function assertNoMatch(rel, pattern, message) {
  const source = read(rel);
  if (pattern.test(source)) {
    violations.push(`${rel}: ${message}`);
  }
}

const BOOTSTRAP_FILES = [
  "apps/marketing/src/tenant/resolve-marketing-bootstrap.ts",
  "apps/marketing/src/tenant/resolve-marketing-site-surfaces.ts",
  "apps/portal/src/tenant/resolve-portal-bootstrap.ts",
];

const BRANDING_FILES = [
  "apps/marketing/src/tenant/fetch-public-tenant-branding.ts",
  "apps/portal/src/tenant/fetch-public-tenant-branding.ts",
];

for (const rel of BOOTSTRAP_FILES) {
  assertMatch(rel, /resolveGuestBootstrapRevalidateSeconds/, "must use resolveGuestBootstrapRevalidateSeconds");
  assertNoMatch(rel, /nextRevalidate:\s*300/, "must not hardcode nextRevalidate: 300");
}

for (const rel of BRANDING_FILES) {
  assertMatch(rel, /fetchGuestPublicTenantBrandingForHost/, "must delegate branding fetch to guest-surface-host");
  assertNoMatch(rel, /\/public\/tenant-branding/, "must not duplicate /public/tenant-branding fetch URL");
}

assertMatch(
  "packages/guest-surface-host/src/index.ts",
  /resolveGuestBootstrapRevalidateSeconds/,
  "guest-surface-host must export resolveGuestBootstrapRevalidateSeconds"
);
assertMatch(
  "packages/guest-surface-host/src/index.ts",
  /fetchPublicTenantBrandingForHost/,
  "guest-surface-host must export fetchPublicTenantBrandingForHost"
);

if (violations.length > 0) {
  console.error("guard-guest-fetch-revalidate-parity: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-guest-fetch-revalidate-parity: PASS");
