#!/usr/bin/env node
/**
 * PSR-6a — historical inventory ratchet.
 * Live tier/demote ownership moved to PSR-6b after option A.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-6a-harbor-production-truth-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-6a-harbor-production-truth-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-6a-harbor-production-truth-inventory") {
  fail("wave must be PSR-6a-harbor-production-truth-inventory");
}
if (inv.decision !== "inventory_only") {
  fail("decision must be inventory_only");
}
if (inv.policy?.live_tier_owned_by !== "PSR-6b-harbor-demote") {
  fail("live_tier_owned_by must be PSR-6b-harbor-demote");
}
if (!inv.ratchet?.historical_snapshot_only) {
  fail("historical_snapshot_only must be true after PSR-6b");
}
if (inv.options?.A_demote_then_persist?.status !== "chosen_in_psr6b") {
  fail("option A must be marked chosen_in_psr6b");
}
if ((inv.gaps || []).length !== inv.ratchet.gap_count) {
  fail("gap_count drift");
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

// Persist gaps still true until PSR-6c
const http = readFileSync(
  join(root, "packages/workspaces/harbor/src/http/harbor-catalog-http.ts"),
  "utf8",
);
if (!http.includes("HARBOR_SMOKE_E2E_SEED")) {
  fail("harbor-catalog-http missing HARBOR_SMOKE_E2E_SEED gate");
}
if (!http.includes("getHarborSmokeCatalogStore")) {
  fail("harbor-catalog-http missing in-memory store wiring");
}

const store = readFileSync(
  join(
    root,
    "packages/workspaces/harbor/src/catalog/harbor-smoke-catalog.store.ts",
  ),
  "utf8",
);
if (!store.includes("private readonly cards = new Map")) {
  fail("store must remain in-memory Map until PSR-6c");
}

if (inv.current_claim_at_inventory_time?.production_tier !== "certified") {
  fail("historical claim must remain certified");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-6a-harbor-production-truth-smoke: OK — historical gaps=${inv.ratchet.gap_count} live_tier_owned_by=PSR-6b persist_still_open`,
);
