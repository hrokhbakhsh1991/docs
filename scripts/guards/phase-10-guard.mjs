#!/usr/bin/env node
/**
 * Phase 10 host invariants — fast enforcement (P7-T03..T05).
 * @see docs/phase-10/phase-10-charter.md
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function assertCheck(name, ok, detail) {
  if (!ok) {
    failures.push(`${name}: ${detail}`);
    console.error(`FAIL ${name}: ${detail}`);
    return;
  }
  console.log(`PASS ${name}`);
}

// P7-T02 — generated registry freshness
const fresh = spawnSync("node", ["scripts/generate-workspace-registry.mjs", "--check"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
});
assertCheck(
  "p10_registry_fresh",
  fresh.status === 0,
  (fresh.stdout ?? "") + (fresh.stderr ?? "") || "stale generated registry"
);

// P7-T03 — plugin singleton imports
const registryGuard = spawnSync("node", ["apps/api/scripts/guard-workspace-registry-imports.mjs"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
});
assertCheck(
  "p10_api_plugin_singleton_allowlist",
  registryGuard.status === 0,
  registryGuard.stderr || "guard-workspace-registry-imports failed"
);

// P7-T04 — outbox product-free
const outboxDir = path.join(REPO_ROOT, "apps/api/src/outbox");
function walkTs(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTs(p, out);
    else if (ent.name.endsWith(".ts")) out.push(p);
  }
  return out;
}
const outboxHits = [];
for (const file of walkTs(outboxDir)) {
  const src = fs.readFileSync(file, "utf8");
  if (/@app-tour\/workspace-denali|@app-tour\/workspace-urban|denali-finance/.test(src)) {
    outboxHits.push(path.relative(REPO_ROOT, file));
  }
}
assertCheck("p10_outbox_product_free", outboxHits.length === 0, outboxHits.join(", ") || "ok");

// P7-T05 — app.ts product path literals
const app = read("apps/api/src/app.ts");
assertCheck(
  "p10_app_ts_product_paths",
  !/["']\/urban\//.test(app) && !/["']\/finance\//.test(app),
  'app.ts must not contain "/urban/" or "/finance/" literals'
);

const urbanShimDir = path.join(REPO_ROOT, "apps/api/src/urban");
assertCheck(
  "p10_urban_api_shims_removed",
  !fs.existsSync(urbanShimDir),
  "apps/api/src/urban/ shims removed — use @app-tour/workspace-urban/http"
);

const denaliFinanceShimFiles = [
  "apps/api/src/denali-finance/finance.routes.ts",
  "apps/api/src/denali-finance/finance.schemas.ts",
  "apps/api/src/denali-finance/configure-denali-finance-http-host.ts",
];
const denaliShimHits = denaliFinanceShimFiles.filter((rel) =>
  fs.existsSync(path.join(REPO_ROOT, rel))
);
assertCheck(
  "p10_denali_finance_shims_removed",
  denaliShimHits.length === 0,
  `denali-finance re-export shims removed — use http/configure-workspace-finance-http-host.ts + @app-tour/workspace-denali/http (${denaliShimHits.join(", ")})`
);
const workspaceFinanceHost = path.join(
  REPO_ROOT,
  "apps/api/src/http/configure-workspace-finance-http-host.ts"
);
assertCheck(
  "p10_workspace_finance_host_present",
  fs.existsSync(workspaceFinanceHost),
  "apps/api/src/http/configure-workspace-finance-http-host.ts must exist"
);

/** DEC-P10-006 — host infra only; no new product shims in workspace-finance/ */
const WORKSPACE_FINANCE_HOST_INFRA_ALLOWLIST = new Set([
  "assert-finance-access.ts",
  "booking-sync-degraded-persist.spec.ts",
  "compile-invoice-balances.ts",
  "enqueue-finance-ledger-capture.ts",
  "finance-chart-of-accounts-registry.ts",
  "finance-capability-gate.spec.ts",
  "finance-dependency-registry.spec.ts",
  "finance-dependency-registry.ts",
  "finance-di-purity.spec.ts",
  "finance-event-reaction-registry.ts",
  "finance-http-contracts.spec.ts",
  "finance-http-handlers-ownership.spec.ts",
  "finance-list-projection.ts",
  "finance-module-enabled.ts",
  "finance-outbox-ownership.spec.ts",
  "finance-registration-context.ts",
  "finance-repository.factory.ts",
  "finance-schedule-domain.ts",
  "finance-schedule-store.ts",
  "finance-service-host-fakes.ts",
  "finance-tenant-dependency-resolution.spec.ts",
  "finance.repository.ts",
  "finance.service.spec.ts",
  "finance.service.ts",
  "finance-ws2-engine.spec.ts",
  "finance-ws3-onboarding.spec.ts",
  "finance-ws4-onboarding.spec.ts",
  "in-memory-finance.repository.ts",
  "finance-list-projection.ts",
  "finance-module-enabled.ts",
  "infrastructure",
  "ports",
  "prisma-workspace-outbox-reader.ts",
  "process-workspace-finance-outbox.ts",
  "receipt-proof-storage.ts",
  "resolve-finance-workspace-type-for-tenant.ts",
  "workspace-finance-bindings.generated.ts",
  "workspace-finance-chart-of-accounts-bindings.generated.ts",
  "workspace-finance-dependency-bindings.generated.ts",
  "workspace-finance-event-reaction-bindings.generated.ts",
  "workspace-finance-processed-log.ts",
]);
const workspaceFinanceDir = path.join(REPO_ROOT, "apps/api/src/workspace-finance");
const workspaceFinanceUnexpected = fs.existsSync(workspaceFinanceDir)
  ? fs
      .readdirSync(workspaceFinanceDir)
      .filter((name) => !WORKSPACE_FINANCE_HOST_INFRA_ALLOWLIST.has(name))
  : [];
assertCheck(
  "p10_workspace_finance_host_infra",
  workspaceFinanceUnexpected.length === 0,
  `workspace-finance/ unexpected files (DEC-P10-006): ${workspaceFinanceUnexpected.join(", ")}`
);

const certGuard = spawnSync("node", ["scripts/guards/guard-workspace-certification.mjs"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
});
assertCheck(
  "p10_workspace_certification_guard",
  certGuard.status === 0,
  (certGuard.stdout ?? "") + (certGuard.stderr ?? "") || "guard-workspace-certification failed"
);

const themeBudgetGuard = spawnSync("node", ["scripts/guards/guard-theme-import-budget.mjs"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
});
assertCheck(
  "p10_theme_import_budget",
  themeBudgetGuard.status === 0,
  (themeBudgetGuard.stdout ?? "") + (themeBudgetGuard.stderr ?? "") || "guard-theme-import-budget failed"
);

const pluginLoadCacheGuard = spawnSync(
  "node",
  ["scripts/guards/guard-workspace-plugin-load-cache.mjs"],
  { cwd: REPO_ROOT, encoding: "utf8" }
);
assertCheck(
  "p10_workspace_plugin_load_cache",
  pluginLoadCacheGuard.status === 0,
  (pluginLoadCacheGuard.stdout ?? "") + (pluginLoadCacheGuard.stderr ?? "") ||
    "guard-workspace-plugin-load-cache failed"
);

if (failures.length > 0) {
  console.error(`phase-10-guard: FAIL (${failures.length})`);
  process.exit(1);
}

console.log("phase-10-guard: PASS");
