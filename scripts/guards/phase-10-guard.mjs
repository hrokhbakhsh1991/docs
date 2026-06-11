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
  `denali-finance re-export shims removed — use http/configure-denali-finance-http-host.ts + @app-tour/workspace-denali/http (${denaliShimHits.join(", ")})`
);
const denaliHost = path.join(REPO_ROOT, "apps/api/src/http/configure-denali-finance-http-host.ts");
assertCheck(
  "p10_denali_finance_host_present",
  fs.existsSync(denaliHost),
  "apps/api/src/http/configure-denali-finance-http-host.ts must exist"
);

/** DEC-P10-006 — host infra only; no new product shims in denali-finance/ */
const DENALI_FINANCE_HOST_INFRA_ALLOWLIST = new Set([
  "assert-finance-access.ts",
  "denali-finance-processed-log.ts",
  "finance.repository.ts",
  "finance.service.ts",
  "prisma-denali-outbox-reader.ts",
  "prisma-denali-outbox-writer.ts",
  "process-denali-finance-outbox.ts",
  "tour-created-finance-side-effect.ts",
]);
const denaliFinanceDir = path.join(REPO_ROOT, "apps/api/src/denali-finance");
const denaliFinanceUnexpected = fs.existsSync(denaliFinanceDir)
  ? fs.readdirSync(denaliFinanceDir).filter((name) => !DENALI_FINANCE_HOST_INFRA_ALLOWLIST.has(name))
  : [];
assertCheck(
  "p10_denali_finance_host_infra",
  denaliFinanceUnexpected.length === 0,
  `denali-finance/ unexpected files (DEC-P10-006): ${denaliFinanceUnexpected.join(", ")}`
);

if (failures.length > 0) {
  console.error(`phase-10-guard: FAIL (${failures.length})`);
  process.exit(1);
}

console.log("phase-10-guard: PASS");
