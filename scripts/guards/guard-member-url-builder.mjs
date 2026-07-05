#!/usr/bin/env node
/**
 * PS-3 — GSH member URL builder guard (Builder Migration Contract).
 * @see docs/dev/guard-member-portal-registry.md §3
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const GSH_SRC = path.join(REPO_ROOT, "packages/guest-surface-host/src");

/** Files allowed to contain the frozen alias path literal. */
const FROZEN_ALIAS_ALLOWLIST = new Set([
  path.join(GSH_SRC, "resolve-portal-member-module-url.ts"),
]);

/** @type {string[]} */
const violations = [];

for (const fileName of fs.readdirSync(GSH_SRC)) {
  if (!fileName.endsWith(".ts")) {
    continue;
  }
  const filePath = path.join(GSH_SRC, fileName);
  const source = fs.readFileSync(filePath, "utf8");

  if (source.includes("/me/registrations") && !FROZEN_ALIAS_ALLOWLIST.has(filePath)) {
    violations.push(`${path.relative(REPO_ROOT, filePath)}: literal /me/registrations (use registry builder)`);
  }

  if (fileName === "resolve-portal-public-base-url.ts" && source.includes("resolvePortalMemberAreaUrl")) {
    violations.push("resolve-portal-public-base-url.ts must not define resolvePortalMemberAreaUrl (delegate lives in member-module-url)");
  }
}

const memberModuleUrl = fs.readFileSync(
  path.join(GSH_SRC, "resolve-portal-member-module-url.ts"),
  "utf8"
);
if (memberModuleUrl.includes("resolvePortalMemberAreaUrl")) {
  violations.push("resolve-portal-member-module-url.ts: resolvePortalMemberAreaUrl removed in PS-7");
}

const gshIndex = fs.readFileSync(path.join(GSH_SRC, "index.ts"), "utf8");
if (gshIndex.includes("resolvePortalMemberAreaUrl")) {
  violations.push("guest-surface-host index.ts: resolvePortalMemberAreaUrl must not be exported (PS-7)");
}

const DEPRECATED_BUILDER_IMPORT_DIRS = [
  path.join(REPO_ROOT, "apps/marketing/src"),
  path.join(REPO_ROOT, "apps/portal/src"),
];

for (const dir of DEPRECATED_BUILDER_IMPORT_DIRS) {
  if (!fs.existsSync(dir)) {
    continue;
  }
  for (const fileName of fs.readdirSync(dir, { recursive: true })) {
    if (typeof fileName !== "string" || !fileName.endsWith(".ts") && !fileName.endsWith(".tsx")) {
      continue;
    }
    const filePath = path.join(dir, fileName);
    if (!fs.statSync(filePath).isFile()) {
      continue;
    }
    const source = fs.readFileSync(filePath, "utf8");
    if (source.includes("resolvePortalMemberAreaUrl")) {
      violations.push(`${path.relative(REPO_ROOT, filePath)}: import resolvePortalMemberModuleUrl instead of deprecated resolvePortalMemberAreaUrl`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-member-url-builder: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-member-url-builder: PASS");
