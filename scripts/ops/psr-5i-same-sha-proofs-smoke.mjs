#!/usr/bin/env node
/**
 * PSR-5i — same-SHA proofs inventory ratchet (no live Postgres / no full gates).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-5i-same-sha-proofs-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-5i-same-sha-proofs-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-5i-same-sha-proofs-inventory") {
  fail("wave must be PSR-5i-same-sha-proofs-inventory");
}
if (inv.decision !== "inventory_recipe_only") {
  fail("decision must be inventory_recipe_only");
}
if (!inv.policy?.forbid_full_gate_in_this_wave) {
  fail("policy.forbid_full_gate_in_this_wave must be true");
}
if (!inv.policy?.forbid_claiming_item_7_complete_without_live_pack) {
  fail("policy.forbid_claiming_item_7_complete_without_live_pack must be true");
}
if (!inv.policy?.live_proof_requires_architect_yes) {
  fail("policy.live_proof_requires_architect_yes must be true");
}
if ((inv.proof_families || []).length !== inv.ratchet.proof_family_count) {
  fail("proof_family_count drift");
}
if (inv.ratchet.live_proof_complete !== false) {
  fail("live_proof_complete must be false until live evidence pack");
}
if (inv.ratchet.item_7_status !== "inventory_complete_live_proof_pending") {
  fail("item_7_status must be inventory_complete_live_proof_pending");
}
if (inv.ratchet.identical_sha_binding_required !== true) {
  fail("identical_sha_binding_required must be true");
}

const requiredIds = ["migration", "restore", "rls_probe", "outbox_effect"];
const ids = new Set((inv.proof_families || []).map((f) => f.id));
for (const id of requiredIds) {
  if (!ids.has(id)) fail(`missing proof family ${id}`);
}

let missing = 0;
for (const fam of inv.proof_families || []) {
  if (fam.live_status !== "pending") {
    fail(`${fam.id} live_status must be pending in inventory wave`);
  }
  if (!Array.isArray(fam.recipe_commands) || fam.recipe_commands.length === 0) {
    fail(`${fam.id} missing recipe_commands`);
  }
  for (const rel of fam.static_assets || []) {
    if (rel === "package.json" || rel === "apps/api/package.json") {
      if (!existsSync(join(root, rel))) {
        missing += 1;
        fail(`missing asset ${rel}`);
      }
      continue;
    }
    if (!existsSync(join(root, rel))) {
      missing += 1;
      fail(`missing asset ${rel}`);
    }
  }
}
if (missing !== inv.ratchet.static_asset_missing_count) {
  fail(
    `static_asset_missing_count drift: live=${missing} inv=${inv.ratchet.static_asset_missing_count}`,
  );
}

for (const cmd of inv.bundled_heavy_paths_forbidden_without_yes || []) {
  if (!String(cmd).includes("phase-") && !String(cmd).includes("ci:integrity") && !String(cmd).includes("test:full")) {
    fail(`unexpected forbidden path entry: ${cmd}`);
  }
}

// package.json must still expose migrate + rls guard scripts
const rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const scripts = rootPkg.scripts || {};
if (!scripts["db:migrate:deploy"] && !scripts["db:migrate"]) {
  fail("root package.json missing db:migrate(:deploy)");
}
if (!scripts["guard:repository-rls"]) {
  fail("root package.json missing guard:repository-rls");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-5i-same-sha-proofs-smoke: OK — families=${inv.ratchet.proof_family_count} live_proof_complete=false item_7=inventory_complete_live_proof_pending`,
);
