#!/usr/bin/env node
/**
 * PSR-6c6 — Harbor durable live-evidence recipe ratchet (no live / no promote).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-6c6-harbor-live-evidence-recipe-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-6c6-harbor-live-evidence-recipe-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-6c6-harbor-live-evidence-recipe") fail("wave mismatch");
if (inv.decision !== "executable_recipe_only") fail("decision mismatch");
if (!inv.policy?.forbid_live_execution_in_this_wave) fail("forbid_live required");
if (!inv.policy?.forbid_tier_promote_in_this_wave) fail("forbid_promote required");
if (inv.ratchet.live_executed !== false) fail("live_executed must be false");
if (inv.ratchet.tier_promoted !== false) fail("tier_promoted must be false");
if ((inv.gaps || []).length !== inv.ratchet.gap_count) fail("gap_count drift");

for (const rel of inv.static_assets || []) {
  if (!existsSync(join(root, rel))) fail(`missing asset ${rel}`);
}

const e2e = readFileSync(
  join(root, "apps/marketing/scripts/smoke-marketing-harbor-e2e-servers.mjs"),
  "utf8",
);
if (!e2e.includes('HARBOR_SMOKE_E2E_SEED: "1"')) {
  fail("expected seed harness still forcing seed=1 (honesty)");
}
if (!e2e.includes('STORAGE_DRIVER: "memory"')) {
  fail("expected seed harness still using memory driver");
}
if (inv.ratchet.seed_harness_still_seed !== true) {
  fail("seed_harness_still_seed must be true");
}

const manifest = JSON.parse(
  readFileSync(
    join(root, "packages/workspaces/harbor/workspace.manifest.json"),
    "utf8",
  ),
);
if (manifest?.guestConformance?.productionTier !== "stub") {
  fail("Harbor must remain stub");
}
if (inv.ratchet.production_tier !== "stub") fail("production_tier drift");

const required = ["H-DEFAULT", "H-REGISTER", "H-DUP", "H-RESTART", "H-RLS", "H-CERT"];
for (const id of required) {
  if (!(inv.proof_families_from_6c5 || []).includes(id)) fail(`missing family ${id}`);
}

const doc = readFileSync(
  join(root, "docs/audits/snapshots/2026-07-31/psr-6c6-harbor-live-evidence-recipe.mdoc"),
  "utf8",
);
if (!doc.includes("G-SEED-E2E-HARNESS") || !doc.includes("unset HARBOR_SMOKE_E2E_SEED")) {
  fail("recipe doc incomplete");
}

if (inv.ratchet.next_slice !== "PSR-7e-rc-evidence-pack-schema") {
  fail("next_slice drift");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-6c6-harbor-live-evidence-recipe-smoke: OK — gaps=${inv.ratchet.gap_count} live=false tier=stub seed_harness=forced next=PSR-7e`,
);
