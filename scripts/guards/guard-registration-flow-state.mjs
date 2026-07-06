#!/usr/bin/env node
/**
 * Canonical registration flow state SSOT — workspace surfaces must not drift.
 * @see docs/dev/guest-plugin-conformance.md § Canonical registration flow state
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACES_DIR = path.join(REPO_ROOT, "packages/workspaces");

/** @type {string[]} */
const violations = [];

function listRegistrationFlowSurfaces() {
  /** @type {string[]} */
  const files = [];
  if (!fs.existsSync(WORKSPACES_DIR)) {
    return files;
  }
  for (const workspaceId of fs.readdirSync(WORKSPACES_DIR)) {
    const root = path.join(WORKSPACES_DIR, workspaceId, "src");
    if (!fs.existsSync(root)) {
      continue;
    }
    walkForSurfaces(root, files);
  }
  return files;
}

/** @param {string} dir @param {string[]} out */
function walkForSurfaces(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkForSurfaces(full, out);
      continue;
    }
    if (entry.isFile() && /registration-flow.*\.surface\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
}

const surfaces = listRegistrationFlowSurfaces();
if (surfaces.length === 0) {
  violations.push("no registration-flow*.surface.ts files found under packages/workspaces");
}

for (const file of surfaces) {
  const rel = path.relative(REPO_ROOT, file);
  const source = fs.readFileSync(file, "utf8");
  if (/\bcreateEmptyData\b/.test(source)) {
    violations.push(`${rel}: banned createEmptyData() — use defineCatalogRegistrationFlowSurface`);
  }
  if (!/\bdefineCatalogRegistrationFlowSurface\b/.test(source)) {
    violations.push(`${rel}: must use defineCatalogRegistrationFlowSurface from workspace-sdk`);
  }
  if (/event\.type === ["']merge["']/.test(source)) {
    violations.push(`${rel}: use applyCatalogRegistrationFlowEvent — do not inline merge/transition`);
  }
  if (!/\bapplyCatalogRegistrationFlowEvent\b/.test(source)) {
    violations.push(`${rel}: resolveNextStep must delegate to applyCatalogRegistrationFlowEvent`);
  }
}

const driftTest = spawnSync(
  "pnpm",
  ["--filter", "@app-tour/catalog-registration-auth", "run", "test"],
  { cwd: REPO_ROOT, encoding: "utf8", stdio: "pipe" }
);
if (driftTest.status !== 0) {
  violations.push("catalog-registration-auth registration-flow-state.spec.ts drift check failed");
  const output = `${driftTest.stdout ?? ""}${driftTest.stderr ?? ""}`.trim();
  if (output.length > 0) {
    console.error(output);
  }
}

if (violations.length > 0) {
  console.error("guard-registration-flow-state: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log(`guard-registration-flow-state: PASS (${surfaces.length} surface(s))`);
