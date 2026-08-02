#!/usr/bin/env node
/**
 * PSR-6c5 — Harbor durable proofs/recert inventory ratchet (no promote / no live).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-6c5-harbor-durable-proofs-recert-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-6c5-harbor-durable-proofs-recert-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-6c5-harbor-durable-proofs-recert-inventory") {
  fail("wave mismatch");
}
if (inv.decision !== "inventory_recipe_only") fail("decision mismatch");
if (!inv.policy?.forbid_tier_promote_in_this_wave) fail("forbid_tier_promote required");
if (!inv.policy?.forbid_proof_matrix_harbor_rows_in_this_wave) {
  fail("forbid_proof_matrix_harbor_rows required");
}
if (!inv.policy?.live_proof_requires_architect_yes) {
  fail("live_proof_requires_architect_yes required");
}
if (!inv.policy?.current_e2e_smoke_is_seed_path_not_durable) {
  fail("must admit current e2e is seed path");
}
if (inv.ratchet.tier_promoted !== false) fail("tier_promoted must be false");
if (inv.ratchet.proof_matrix_has_harbor !== false) {
  fail("proof_matrix_has_harbor must be false");
}
if (inv.ratchet.live_proof_complete !== false) fail("live_proof_complete must be false");
if (inv.ratchet.psr6_gate_closed !== false) fail("psr6_gate_closed must be false");
if ((inv.proof_families || []).length !== inv.ratchet.proof_family_count) {
  fail("proof_family_count drift");
}

const required = ["H-DEFAULT", "H-REGISTER", "H-DUP", "H-RESTART", "H-RLS", "H-CERT"];
const ids = new Set((inv.proof_families || []).map((f) => f.id));
for (const id of required) {
  if (!ids.has(id)) fail(`missing proof family ${id}`);
}

let missing = 0;
for (const fam of inv.proof_families || []) {
  for (const rel of fam.static_assets || []) {
    if (!existsSync(join(root, rel))) {
      missing += 1;
      fail(`missing asset ${rel}`);
    }
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
  fail("Harbor must remain stub until live recert");
}
if (manifest.guestConformance.productionTier !== inv.code_truth_after_6c4.production_tier) {
  fail("code_truth production_tier drift");
}

const matrix = readFileSync(
  join(root, "docs/dev/workspace-certification-proof-matrix.yaml"),
  "utf8",
);
if (/^  harbor:/m.test(matrix)) {
  fail("proof matrix must not have live plugins.harbor until promote wave");
}

const e2eServers = readFileSync(
  join(root, "apps/marketing/scripts/smoke-marketing-harbor-e2e-servers.mjs"),
  "utf8",
);
if (!e2eServers.includes('HARBOR_SMOKE_E2E_SEED: "1"')) {
  fail("expected current harbor e2e to force seed=1 (honesty gap)");
}

const http = readFileSync(
  join(root, "packages/workspaces/harbor/src/http/harbor-catalog-http.ts"),
  "utf8",
);
if (!http.includes("postDurableHarborRegistration")) {
  fail("durable register path missing");
}
if (!http.includes("listDurableHarborCatalog")) {
  fail("durable list path missing");
}

const runbook = readFileSync(
  join(root, "docs/workspaces/harbor/certification.md"),
  "utf8",
);
if (!runbook.includes("**`stub`**") && !/Current tier[\s\S]*stub/i.test(runbook)) {
  fail("runbook must state stub");
}
if (!runbook.includes("PSR-6c5") && !runbook.includes("Recert checklist")) {
  fail("runbook must include PSR-6c5 recert checklist section");
}

if (inv.ratchet.next_slice !== "PSR-6c6-harbor-live-evidence") {
  fail("next_slice drift");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-6c5-harbor-durable-proofs-recert-smoke: OK — families=${inv.ratchet.proof_family_count} tier=stub live=false psr6_gate=open next=PSR-6c6`,
);
