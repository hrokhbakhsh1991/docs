#!/usr/bin/env node
/**
 * PSR-6c — Harbor persistent catalog inventory ratchet (no wire).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-6c-harbor-persistent-catalog-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-6c-harbor-persistent-catalog-smoke: FAIL — ${msg}`);
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

const inv = loadYaml(invPath);
if (inv.wave !== "PSR-6c-harbor-persistent-catalog-inventory") {
  fail("wave mismatch");
}
if (inv.decision !== "inventory_only") fail("decision must be inventory_only");
if (!inv.policy?.forbid_handler_mutate_in_this_wave) {
  fail("forbid_handler_mutate required");
}
if (!inv.policy?.forbid_denali_catalog_clone) {
  fail("forbid_denali_catalog_clone required");
}
if (!inv.policy?.require_thin_harbor_plus_host_ports) {
  fail("require_thin_harbor_plus_host_ports required");
}
if (inv.ratchet.wire_executed !== true) fail("wire_executed must be true after PSR-6c3");
if (inv.ratchet.inventory_complete !== true) fail("inventory_complete must be true");
if ((inv.gaps || []).length !== inv.ratchet.gap_count) fail("gap_count drift");
const blockers = (inv.gaps || []).filter((g) => g.severity === "blocker");
if (blockers.length !== inv.ratchet.blocker_gap_count) {
  fail(`blocker_gap_count drift live=${blockers.length}`);
}

let missing = 0;
for (const rel of inv.static_assets || []) {
  if (!existsSync(join(root, rel))) {
    missing += 1;
    fail(`missing asset ${rel}`);
  }
}
if (missing !== inv.ratchet.static_asset_missing_count) {
  fail("static_asset_missing_count drift");
}

const manifest = JSON.parse(
  readFileSync(
    join(root, "packages/workspaces/harbor/workspace.manifest.json"),
    "utf8",
  ),
);
if (manifest?.guestConformance?.productionTier !== "stub") {
  fail("Harbor must remain stub until durable path (PSR-6b)");
}

const http = readFileSync(
  join(root, "packages/workspaces/harbor/src/http/harbor-catalog-http.ts"),
  "utf8",
);
if (!http.includes("HARBOR_SMOKE_E2E_SEED")) {
  fail("seed gate still expected until later 6c slice");
}
if (!http.includes("getHarborSmokeCatalogStore")) {
  fail("memory store wiring still expected until wire slice");
}
if (http.includes("catalog.service") || http.includes("listDenaliCatalog")) {
  fail("denali catalog clone detected in harbor http");
}

const store = readFileSync(
  join(
    root,
    "packages/workspaces/harbor/src/catalog/harbor-smoke-catalog.store.ts",
  ),
  "utf8",
);
if (!store.includes("private readonly cards = new Map")) {
  fail("memory Map expected until wire");
}

const configure = readFileSync(
  join(root, "apps/api/src/http/configure-product-http-hosts.ts"),
  "utf8",
);
if (!configure.includes("configureDenaliProductHttpHost")) {
  fail("Denali host configure missing (reference broken)");
}
if (!configure.includes("configureHarborHttpHost")) {
  fail("Harbor host configure expected after PSR-6c3");
}

const intake = readFileSync(
  join(root, "packages/workspaces/harbor/src/catalog/catalog-intake.ts"),
  "utf8",
);
if (!intake.includes('/harbor/registrations')) {
  fail("intake must target /harbor/registrations");
}

const sdk = readFileSync(
  join(
    root,
    "packages/workspace-sdk/src/http/create-workspace-guest-smoke-http-handlers.ts",
  ),
  "utf8",
);
if (!sdk.includes("isSeedEnabled")) fail("SDK seed gate missing");
// Sync port shape evidence
if (!sdk.includes("listPublished: () => readonly TCard[]")) {
  // allow formatting variants
  if (!/listPublished:\s*\(\)\s*=>/.test(sdk)) {
    fail("SDK catalog port sync listPublished evidence missing");
  }
}

if (inv.ratchet.next_slice !== "PSR-6c5-harbor-durable-proofs-recert") {
  fail("next_slice must be PSR-6c5-harbor-durable-proofs-recert");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-6c-harbor-persistent-catalog-smoke: OK — gaps=${inv.ratchet.gap_count} historical; live next=${inv.ratchet.next_slice}`,
);
