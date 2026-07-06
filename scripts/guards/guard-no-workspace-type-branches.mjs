#!/usr/bin/env node
/**
 * Phase C — platform must not branch on workspace ids in guarded surfaces.
 * C1: no workspaceType === "urban" in apps/api/src (except generated + tests).
 * C2: no pluginId === "denali" in tours/wizard-template page clients.
 * @see docs/architecture/platform-architecture-v2.md
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

/** @param {string} dir */
function walkTsFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      files.push(...walkTsFiles(abs));
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(abs);
    }
  }
  return files;
}

/** @param {string} rel */
function isApiExcluded(rel) {
  if (rel.endsWith(".generated.ts")) {
    return true;
  }
  if (rel.includes("/test/")) {
    return true;
  }
  if (rel.endsWith(".spec.ts")) {
    return true;
  }
  if (rel === "apps/api/src/tenant/resolve-workspace-type.ts") {
    return true;
  }
  return false;
}

const urbanPattern = /workspaceType\s*===\s*["']urban["']/;
const pluginIdPattern = /pluginId\s*===\s*["']denali["']/;

const API_ROOT = path.join(REPO_ROOT, "apps/api/src");
const C2_TARGETS = [
  "apps/web/app/(app)/tours/tours-page-client.tsx",
  "apps/web/app/(app)/settings/tour-wizard-template/wizard-template-client.tsx",
];

for (const abs of walkTsFiles(API_ROOT)) {
  const rel = path.relative(REPO_ROOT, abs);
  if (isApiExcluded(rel)) {
    continue;
  }
  const lines = readFileSync(abs, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (urbanPattern.test(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden workspaceType urban branch — ${lines[i].trim()}`);
    }
  }
}

for (const rel of C2_TARGETS) {
  const abs = path.join(REPO_ROOT, rel);
  const lines = readFileSync(abs, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (pluginIdPattern.test(lines[i])) {
      violations.push(`${rel}:${i + 1}: forbidden pluginId denali branch — ${lines[i].trim()}`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-no-workspace-type-branches: FAIL");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-no-workspace-type-branches: PASS");
