#!/usr/bin/env node
/**
 * DEC-074 / Phase 4 step 4 — tenant registry cache invalidation on write.
 * @see docs/phase-5/appendices/tenant-registry-cache-invalidation.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const cache = read("src/tenant/tenant-registry-cache.ts");
if (!cache.includes("invalidateTenantRegistryCache")) {
  violations.push("tenant-registry-cache.ts must export invalidateTenantRegistryCache");
}
if (!cache.includes("tenant_registry_cache_invalidated_total")) {
  violations.push(
    "tenant-registry-cache.ts must increment tenant_registry_cache_invalidated_total"
  );
}
if (!cache.includes("bySubdomain.delete")) {
  violations.push("invalidate must clear bySubdomain when subdomain provided (PU-F-04)");
}

const provisioning = read("src/internal/provisioning.service.ts");
if (!provisioning.includes("invalidateTenantRegistryCache")) {
  violations.push("provisioning.service.ts must invalidate cache after tenant writes");
}

const updateRow = read("src/tenant/update-tenant-registry-row.ts");
if (!updateRow.includes("invalidateTenantRegistryCache")) {
  violations.push("update-tenant-registry-row.ts must invalidate cache after update");
}

const dynamicSync = read("test/4-integration/dynamic-config-sync.spec.ts");
if (!dynamicSync.includes("updateTenantRegistryRow")) {
  violations.push("dynamic-config-sync.spec.ts must use updateTenantRegistryRow for admin writes");
}
const midLoadBlock = dynamicSync.match(
  /if \(i === UPDATE_AT_REQUEST[\s\S]*?dbUpdated = true;\s*\}/
);
if (midLoadBlock !== null && midLoadBlock[0].includes("resetTenantRegistryCacheForTests")) {
  violations.push(
    "dynamic-config-sync mid-load path must not use resetTenantRegistryCacheForTests"
  );
}

const specPath = "src/tenant/tenant-registry-cache-invalidation.spec.ts";
if (!fs.existsSync(path.join(ROOT, specPath))) {
  violations.push(`${specPath} must exist`);
}

if (violations.length > 0) {
  console.error("guard-tenant-registry-cache-invalidation: FAIL");
  for (const v of violations) {
    console.error(`  ${v}`);
  }
  process.exit(1);
}

console.log("guard-tenant-registry-cache-invalidation: PASS");
