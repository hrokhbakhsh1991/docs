#!/usr/bin/env node
/**
 * PSR-5-data-authority-inventory — dual-store factories + getPrismaAdmin classification ratchet.
 * Inventory-only wave: no refactor required; fails on drift / unclassified api src files.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-5-data-authority-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-5-data-authority-inventory-smoke: FAIL — ${msg}`);
  process.exitCode = 1;
}

function loadYaml(abs) {
  const py = `
import json, sys, yaml
from datetime import date, datetime
def default(o):
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    raise TypeError(type(o))
with open(sys.argv[1], encoding="utf-8") as f:
    json.dump(yaml.safe_load(f), sys.stdout, default=default)
`;
  const r = spawnSync("python3", ["-c", py, abs], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "yaml failed");
  return JSON.parse(r.stdout);
}

const FACTORIES = [
  "apps/api/src/bookings/create-bookings-repository.ts",
  "apps/api/src/identity/create-identity-repository.ts",
  "apps/api/src/identity/portal-member-plan.service.ts",
  "apps/api/src/storage/create-tour-storage.ts",
  "apps/api/src/settings/create-settings-audit-repository.ts",
  "apps/api/src/settings/create-settings-config-repository.ts",
  "apps/api/src/settings/create-settings-resources-repository.ts",
  "apps/api/src/workspace-drafts/create-workspace-drafts-repository.ts",
  "apps/api/src/workspace-drafts/create-workspace-draft-events-repository.ts",
  "apps/api/src/workspace-finance/finance-repository.factory.ts",
];

function classify(rel) {
  if (rel === "db/prisma.ts") return "definition";
  if (rel.toLowerCase().includes("seed") && !rel.startsWith("routes/")) return "seed_dev";
  if (rel === "tenant/tenant-registry-admin.port.ts") return "tenant_registry_port";
  if (rel === "platform/platform-admin-client.ts") return "platform_admin_client";
  if (rel === "db/background-admin-client.ts") return "background_admin_client";
  if (rel === "identity/identity-admin-client.ts") return "identity_admin_client";
  if (
    rel.startsWith("platform/") ||
    rel.startsWith("routes/platform/") ||
    rel.startsWith("internal/provisioning") ||
    rel.startsWith("workspace-metadata/workspace-definition")
  ) {
    return "control_plane";
  }
  if (
    rel.startsWith("outbox/") ||
    rel.startsWith("workspace-finance/recon/") ||
    rel.startsWith("events/") ||
    rel.startsWith("http/http-idempotency-reclaim") ||
    rel.startsWith("integrations/worker/") ||
    rel.startsWith("integrations/migration/") ||
    rel.startsWith("integrations/infrastructure/prisma-integration-delivery") ||
    rel.includes("finance-ops-metrics")
  ) {
    return "background_repair";
  }
  if (rel.startsWith("tenant/")) return "tenant_registry";
  if (
    rel.startsWith("identity/prisma-identity") ||
    rel.includes("resolve-finance-workspace-type")
  ) {
    return "tenant_path_allowlist_candidate";
  }
  if (
    rel.startsWith("integrations/infrastructure/") ||
    rel.startsWith("bookings/") ||
    rel.startsWith("tours/") ||
    (rel.startsWith("routes/") && !rel.startsWith("routes/platform"))
  ) {
    return "tenant_path_review";
  }
  return "unclassified";
}

function walkTs(dir, out = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === "dist") continue;
      walkTs(abs, out);
      continue;
    }
    if (!name.name.endsWith(".ts") || name.name.endsWith(".spec.ts")) continue;
    out.push(abs);
  }
  return out;
}

const inv = loadYaml(invPath);
if (inv.wave !== "PSR-5-data-authority-inventory") {
  fail("inventory wave must be PSR-5-data-authority-inventory");
}
if (inv.decision !== "inventory_only") fail("decision must be inventory_only");
if (!inv.policy?.forbid_refactor_in_this_wave) {
  fail("policy.forbid_refactor_in_this_wave must be true");
}
if (!inv.policy?.memory_forbidden_in_production) {
  fail("policy.memory_forbidden_in_production must be true");
}

const financePath = "apps/api/src/workspace-finance/finance-repository.factory.ts";
let missingAssert = 0;
for (const rel of FACTORIES) {
  const text = readFileSync(join(root, rel), "utf8");
  const hasAssert = text.includes("assertProductionStorageDriver");
  const hasResolve = text.includes("resolveStorageDriver");
  if (!hasResolve) fail(`${rel} must call resolveStorageDriver`);
  if (!text.includes("InMemory")) fail(`${rel} must retain InMemory branch for test|dev`);
  if (!hasAssert) {
    missingAssert += 1;
    fail(`${rel} missing assertProductionStorageDriver (PSR-5a closed finance gap)`);
  }
}
if (missingAssert !== 0) {
  fail(`expected 0 factories missing assert after PSR-5a; got ${missingAssert}`);
}
if (FACTORIES.length !== inv.ratchet.dual_store_factory_count) {
  fail(
    `dual_store_factory_count drift: live=${FACTORIES.length} inv=${inv.ratchet.dual_store_factory_count}`,
  );
}
if (inv.ratchet.dual_store_missing_assert_count !== 0) {
  fail("ratchet.dual_store_missing_assert_count must be 0 after PSR-5a");
}
if (inv.ratchet.finance_factory_missing_assert !== false) {
  fail("ratchet.finance_factory_missing_assert must be false after PSR-5a");
}
// finance still dual-store
{
  const text = readFileSync(join(root, financePath), "utf8");
  if (!text.includes("assertProductionStorageDriver()")) {
    fail("finance factory must invoke assertProductionStorageDriver()");
  }
}

const apiSrc = join(root, "apps/api/src");
const liveFiles = [];
let liveCalls = 0;
let unclassified = 0;
for (const abs of walkTs(apiSrc)) {
  const text = readFileSync(abs, "utf8");
  if (!text.includes("getPrismaAdmin")) continue;
  const rel = relative(apiSrc, abs).split("\\").join("/");
  const calls = (text.match(/\bgetPrismaAdmin\s*\(/g) || []).length;
  const cls = classify(rel);
  if (cls === "unclassified") unclassified += 1;
  liveFiles.push({ path: `apps/api/src/${rel}`, calls, class: cls });
  liveCalls += calls;
}

if (unclassified !== 0) {
  fail(`unclassified api src getPrismaAdmin files: ${unclassified}`);
}
if (liveFiles.length !== inv.ratchet.api_src_admin_files) {
  fail(
    `api_src_admin_files drift: live=${liveFiles.length} inv=${inv.ratchet.api_src_admin_files}`,
  );
}
if (liveCalls !== inv.ratchet.api_src_admin_calls) {
  fail(
    `api_src_admin_calls drift: live=${liveCalls} inv=${inv.ratchet.api_src_admin_calls}`,
  );
}
if (inv.ratchet.unclassified_api_src_files !== 0) {
  fail("ratchet.unclassified_api_src_files must be 0");
}
if (inv.ratchet.tenant_registry_direct_admin_files !== 0) {
  fail("ratchet.tenant_registry_direct_admin_files must be 0 after PSR-5c");
}
if (inv.ratchet.control_plane_direct_admin_files !== 0) {
  fail("ratchet.control_plane_direct_admin_files must be 0 after PSR-5e10");
}
const liveTenantRegistry = liveFiles.filter((f) => f.class === "tenant_registry");
if (liveTenantRegistry.length !== 0) {
  fail(
    `direct tenant_registry getPrismaAdmin remains: ${liveTenantRegistry.map((f) => f.path).join(", ")}`,
  );
}
const liveControlPlane = liveFiles.filter((f) => f.class === "control_plane");
if (liveControlPlane.length !== 0) {
  fail(
    `direct control_plane getPrismaAdmin remains: ${liveControlPlane.map((f) => f.path).join(", ")}`,
  );
}
const livePort = liveFiles.filter((f) => f.class === "tenant_registry_port");
if (livePort.length !== 1) {
  fail(`expected exactly 1 tenant_registry_port file; got ${livePort.length}`);
}
const livePlatformClient = liveFiles.filter((f) => f.class === "platform_admin_client");
if (livePlatformClient.length !== 1) {
  fail(`expected exactly 1 platform_admin_client file; got ${livePlatformClient.length}`);
}
const liveBackgroundClient = liveFiles.filter((f) => f.class === "background_admin_client");
if (liveBackgroundClient.length !== 1) {
  fail(`expected exactly 1 background_admin_client file; got ${liveBackgroundClient.length}`);
}
const liveIdentityClient = liveFiles.filter((f) => f.class === "identity_admin_client");
if (liveIdentityClient.length !== 1) {
  fail(`expected exactly 1 identity_admin_client file; got ${liveIdentityClient.length}`);
}
const liveAllowlistCandidate = liveFiles.filter((f) => f.class === "tenant_path_allowlist_candidate");
if (
  inv.ratchet.tenant_path_allowlist_candidate_files != null &&
  liveAllowlistCandidate.length !== inv.ratchet.tenant_path_allowlist_candidate_files
) {
  fail(
    `tenant_path_allowlist_candidate_files drift: live=${liveAllowlistCandidate.length} inv=${inv.ratchet.tenant_path_allowlist_candidate_files}`,
  );
}
const liveBackgroundRepair = liveFiles.filter((f) => f.class === "background_repair");
if (
  inv.ratchet.background_repair_direct_admin_files != null &&
  liveBackgroundRepair.length !== inv.ratchet.background_repair_direct_admin_files
) {
  fail(
    `background_repair_direct_admin_files drift: live=${liveBackgroundRepair.length} inv=${inv.ratchet.background_repair_direct_admin_files}`,
  );
}

const invPaths = new Set((inv.get_prisma_admin?.files || []).map((f) => f.path));
const livePaths = new Set(liveFiles.map((f) => f.path));
for (const p of livePaths) {
  if (!invPaths.has(p)) fail(`inventory missing live admin file: ${p}`);
}
for (const p of invPaths) {
  if (!livePaths.has(p)) fail(`inventory has stale admin file: ${p}`);
}

// Boot enforcer still present
const assertSrc = readFileSync(
  join(root, "apps/api/src/storage/production-storage-driver-assert.ts"),
  "utf8",
);
if (!assertSrc.includes("PRODUCTION_STORAGE_DRIVER_FORBIDDEN")) {
  fail("production storage assert missing PRODUCTION_STORAGE_DRIVER_FORBIDDEN");
}
const runtimeSrc = readFileSync(
  join(root, "apps/api/src/server/production-runtime-env.ts"),
  "utf8",
);
if (!runtimeSrc.includes("assertProductionStorageDriver")) {
  fail("assertProductionRuntimeIntegrity must call assertProductionStorageDriver");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log(
  `psr-5-data-authority-inventory-smoke: OK — factories=${FACTORIES.length} missing_assert=0 admin_files=${liveFiles.length} admin_calls=${liveCalls} unclassified=0`,
);
