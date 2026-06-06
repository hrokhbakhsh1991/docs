#!/usr/bin/env node
/**
 * DEC-090 / Wave D — feature flags must use theme cache (FF-RC-02).
 * @see docs/phase-5/appendices/tenant-registry-cache-coherence.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const flags = read("src/tenant/resolve-tenant-feature-flags.ts");
if (!flags.includes("resolveTenantThemeJsonById")) {
  violations.push("resolve-tenant-feature-flags.ts must call resolveTenantThemeJsonById");
}
if (flags.includes("getPrismaAdmin")) {
  violations.push("resolve-tenant-feature-flags.ts must not call getPrismaAdmin directly");
}
if (flags.includes("tenant.findUnique")) {
  violations.push("resolve-tenant-feature-flags.ts must not query tenant.findUnique directly");
}

for (const spec of ["test/4-integration/tenant-registry-cache-coherence.spec.ts"]) {
  if (!fs.existsSync(path.join(ROOT, spec))) {
    violations.push(`${spec} must exist`);
  }
}

if (violations.length > 0) {
  console.error("guard-tenant-registry-cache-coherence: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-tenant-registry-cache-coherence: PASS");
