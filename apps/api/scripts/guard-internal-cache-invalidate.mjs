#!/usr/bin/env node
/** DEC-106 + DEC-120 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(API_ROOT, "../..");
const violations = [];
const readApi = (rel) => fs.readFileSync(path.join(API_ROOT, rel), "utf8");

for (const rel of [
  "src/routes/internal/cache-invalidate.ts",
  "src/middleware/flush-redis-rate-limit-keys.ts",
  "src/internal/verify-cache-invalidate-service-jwt.ts",
  "src/tenant/feature-flag-freeze.ts",
  "test/4-integration/internal-cache-invalidate.spec.ts",
  "src/internal/verify-cache-invalidate-service-jwt.spec.ts",
  "src/tenant/feature-flag-freeze.spec.ts",
]) {
  if (!fs.existsSync(path.join(API_ROOT, rel))) {
    violations.push(`${rel} must exist`);
  }
}

const docPath = "docs/phase-5/appendices/prod-cache-invalidate-service-jwt.md";
if (!fs.existsSync(path.join(REPO_ROOT, docPath))) {
  violations.push(docPath);
}

const app = readApi("src/app.ts");
if (!app.includes("/internal/cache/invalidate")) {
  violations.push("app.ts must wire POST /internal/cache/invalidate");
}

const route = readApi("src/routes/internal/cache-invalidate.ts");
if (!route.includes("assertProvisioningDevelopmentOnly")) {
  violations.push("cache-invalidate must keep dev/test gate");
}
if (!route.includes("assertCacheInvalidateServiceJwt")) {
  violations.push("cache-invalidate must verify service JWT in production (DEC-120)");
}
if (!route.includes("invalidateTenantRegistryCache")) {
  violations.push("cache-invalidate must call invalidateTenantRegistryCache");
}
if (!route.includes("activateFeatureFlagFreeze")) {
  violations.push("cache-invalidate must support feature-flag freeze (DEC-120)");
}

const verifier = readApi("src/internal/verify-ops-service-jwt.ts");
if (!verifier.includes("cache:invalidate")) {
  violations.push("verify-ops-service-jwt must define cache:invalidate scope");
}

const flags = readApi("src/tenant/resolve-tenant-feature-flags.ts");
if (!flags.includes("isFeatureFlagFreezeActive")) {
  violations.push("resolve-tenant-feature-flags must honor feature-flag freeze");
}

if (violations.length) {
  console.error("guard-internal-cache-invalidate: FAIL");
  violations.forEach((v) => console.error(`  ${v}`));
  process.exit(1);
}
console.log("guard-internal-cache-invalidate: PASS");
