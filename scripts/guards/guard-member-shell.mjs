#!/usr/bin/env node
/**
 * PS-1 — member portal shell landmark guard (DL-01, DL-27).
 * @see docs/dev/guard-member-portal-registry.md §6
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

const meLayoutPath = path.join(REPO_ROOT, "apps/portal/app/me/layout.tsx");
const meLayout = fs.readFileSync(meLayoutPath, "utf8");
if (/<nav/.test(meLayout)) {
  violations.push("apps/portal/app/me/layout.tsx: inline <nav> forbidden after PS-1");
}
if (!/PortalMemberShell/.test(meLayout)) {
  violations.push("apps/portal/app/me/layout.tsx: must render PortalMemberShell");
}
if (!/resolveEmbeddedMemberPortalHost|data-embedded-host/.test(meLayout + fs.readFileSync(path.join(REPO_ROOT, "apps/portal/src/shell/portal-member-shell.tsx"), "utf8"))) {
  violations.push("portal shell: missing data-portal-shell / embedded host wiring");
}

const shellPath = path.join(REPO_ROOT, "apps/portal/src/shell/portal-member-shell.tsx");
const shell = fs.readFileSync(shellPath, "utf8");
if (!/data-portal-shell/.test(shell)) {
  violations.push("portal-member-shell.tsx: missing data-portal-shell landmark");
}
if (/data-portal-member-shell/.test(shell)) {
  violations.push("portal-member-shell.tsx: legacy data-portal-member-shell removed in PS-7");
}

const registerFlowPath = path.join(
  REPO_ROOT,
  "apps/portal/src/catalog/public-catalog-registration-flow.tsx"
);
const registerFlow = fs.readFileSync(registerFlowPath, "utf8");
if (/PortalMemberBottomNav|data-portal-shell-bottom-nav/.test(registerFlow)) {
  violations.push("catalog registration flow: must not render full member bottom nav (DL-01)");
}

const hardcodedMemberHref = /href=\{?["'`]\/me\//;
const meAppDir = path.join(REPO_ROOT, "apps/portal/app/me");
function scanPortalMeTsx(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanPortalMeTsx(full);
      continue;
    }
    if (!entry.name.endsWith(".tsx")) {
      continue;
    }
    const rel = path.relative(REPO_ROOT, full);
    const source = fs.readFileSync(full, "utf8");
    if (hardcodedMemberHref.test(source) && !source.includes("resolve-member-portal-routes.server")) {
      violations.push(`${rel}: hardcoded /me/ href — use resolve-member-portal-routes.server`);
    }
  }
}
scanPortalMeTsx(meAppDir);

if (violations.length > 0) {
  console.error("guard-member-shell: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-member-shell: PASS");
