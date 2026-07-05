#!/usr/bin/env node
/**
 * PS-2 — member portal registry guard (manifest-driven nav).
 * @see docs/dev/guard-member-portal-registry.md
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORTAL_SHELL_DIR = path.join(REPO_ROOT, "apps/portal/src/shell");

/** @type {string[]} */
const violations = [];

const registryCheck = spawnSync("node", ["scripts/generate-workspace-registry.mjs", "--check"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
  stdio: "pipe",
});
if (registryCheck.status !== 0) {
  violations.push("generate:workspace-registry --check failed (stale memberPortal codegen?)");
  const output = `${registryCheck.stdout ?? ""}${registryCheck.stderr ?? ""}`.trim();
  if (output.length > 0) {
    violations.push(output);
  }
}

async function assertL4ReferenceConformance() {
  const moduleUrl = pathToFileURL(
    path.join(REPO_ROOT, "scripts/generate-workspace-registry.mjs")
  ).href;
  const { discoverManifests, assertMemberPortalL4ReferenceWorkspaces } = await import(moduleUrl);
  assertMemberPortalL4ReferenceWorkspaces(discoverManifests());
}

await assertL4ReferenceConformance();

const hardcodedHrefPattern = /href=["'`]\/me\/(registrations|profile)/;
const allowlist = new Set([
  path.join(PORTAL_SHELL_DIR, "resolve-portal-member-nav.server.ts"),
]);

for (const fileName of fs.readdirSync(PORTAL_SHELL_DIR)) {
  if (!fileName.endsWith(".tsx") && !fileName.endsWith(".ts")) {
    continue;
  }
  const filePath = path.join(PORTAL_SHELL_DIR, fileName);
  if (allowlist.has(filePath)) {
    continue;
  }
  const source = fs.readFileSync(filePath, "utf8");
  if (hardcodedHrefPattern.test(source)) {
    violations.push(`${path.relative(REPO_ROOT, filePath)}: hardcoded member nav href`);
  }
}

const meLayoutPath = path.join(REPO_ROOT, "apps/portal/app/me/layout.tsx");
const meLayout = fs.readFileSync(meLayoutPath, "utf8");
if (/<nav/.test(meLayout) || hardcodedHrefPattern.test(meLayout)) {
  violations.push("apps/portal/app/me/layout.tsx: inline nav or hardcoded member href");
}

if (violations.length > 0) {
  console.error("guard-member-portal-registry: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-member-portal-registry: PASS");
