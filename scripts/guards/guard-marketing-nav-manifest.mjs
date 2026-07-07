#!/usr/bin/env node
/**
 * MKT-NAV-01 — marketing shell nav resolves from workspace manifest only.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RESOLVER = path.join(
  REPO_ROOT,
  "apps/marketing/src/shell/resolve-marketing-shell-nav.server.ts"
);
const SHELL = path.join(REPO_ROOT, "apps/marketing/src/shell/marketing-shell.tsx");

/** @type {string[]} */
const violations = [];

const resolver = readFileSync(RESOLVER, "utf8");
const shell = readFileSync(SHELL, "utf8");

if (!resolver.includes("resolveGuestCrossSurfaceNav")) {
  violations.push("resolve-marketing-shell-nav must use resolveGuestCrossSurfaceNav from workspace-sdk");
}
if (/href:\s*"\/tours"/.test(resolver) && !resolver.includes("CLUB_FALLBACK_NAV")) {
  violations.push("resolve-marketing-shell-nav must not hardcode denali nav paths outside fallback");
}
if (shell.includes("FULL_LANDING_NAV")) {
  violations.push("marketing-shell must not define hardcoded nav link tables");
}

if (violations.length > 0) {
  console.error("guard-marketing-nav-manifest: FAIL");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log("guard-marketing-nav-manifest: PASS");
