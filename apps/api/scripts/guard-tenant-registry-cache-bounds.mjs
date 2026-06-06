#!/usr/bin/env node
/**
 * SCAL-DEBT-12 / DEC-068 — tenant registry cache max-size sweep.
 * @see docs/phase-5/appendices/registry-cache-bounds.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GATE = path.join(ROOT, "scripts/phase-3-regression-gate.mjs");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const cache = read("src/tenant/tenant-registry-cache.ts");
if (!cache.includes("resolveTenantRegistryCacheMaxEntries")) {
  violations.push("tenant-registry-cache.ts must read TENANT_REGISTRY_CACHE_MAX_ENTRIES");
}
if (!cache.includes("enforceTenantMapBounds")) {
  violations.push("tenant-registry-cache.ts must enforce tenant map bounds");
}
if (!cache.includes("enforceThemeMapBounds")) {
  violations.push("tenant-registry-cache.ts must enforce theme map bounds");
}

const gateSource = fs.readFileSync(GATE, "utf8");
if (!gateSource.includes("tenant-registry-cache.spec.ts")) {
  violations.push("phase-3-regression-gate must run tenant-registry-cache.spec.ts");
}

if (violations.length > 0) {
  console.error("guard-tenant-registry-cache-bounds: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-tenant-registry-cache-bounds: PASS");
