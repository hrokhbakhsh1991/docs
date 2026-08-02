#!/usr/bin/env node
/**
 * PSR-8c — Governance files inventory ratchet (no license / no file landing).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-8c-governance-files-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-8c-governance-files-inventory-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-8c-governance-files-inventory") fail("wave mismatch");
if (inv.decision !== "inventory_recipe_only") fail("decision mismatch");
if (!inv.policy?.forbid_license_choice_in_this_wave) fail("forbid_license_choice required");
if (!inv.policy?.forbid_writing_governance_files_in_this_wave) {
  fail("forbid_writing_governance_files required");
}
if (inv.ratchet.license_chosen !== false) fail("license_chosen must be false");
if (inv.ratchet.l_gov_closed !== false) fail("l_gov_closed must be false");
if (inv.ratchet.psr8_gate_closed !== false) fail("psr8_gate_closed must be false");
if (inv.publication_model_decided !== false) fail("publication_model must be undecided");

for (const rel of inv.static_assets || []) {
  if (!existsSync(join(root, rel))) fail(`missing asset ${rel}`);
}

let trio = 0;
const trioPaths = ["LICENSE", "LICENSE.md", "SECURITY.md", "CONTRIBUTING.md"];
// LICENSE and LICENSE.md count as one slot for "license present"
const hasLicense =
  existsSync(join(root, "LICENSE")) || existsSync(join(root, "LICENSE.md"));
if (hasLicense) trio += 1;
if (existsSync(join(root, "SECURITY.md"))) trio += 1;
if (existsSync(join(root, "CONTRIBUTING.md"))) trio += 1;

if (trio !== inv.ratchet.required_trio_present_count) {
  fail(
    `required_trio_present_count drift got=${trio} want=${inv.ratchet.required_trio_present_count}`,
  );
}

for (const f of inv.files || []) {
  const present = existsSync(join(root, f.path));
  if (present !== f.present) {
    fail(`presence drift for ${f.path}: disk=${present} inv=${f.present}`);
  }
}

for (const rel of inv.unlicensed_packages || []) {
  const abs = join(root, rel);
  if (!existsSync(abs)) fail(`missing unlicensed package path ${rel}`);
  const pkg = JSON.parse(readFileSync(abs, "utf8"));
  if (pkg.license !== "UNLICENSED") {
    fail(`${rel} license is ${pkg.license}, expected UNLICENSED — update inventory`);
  }
}

const doc = readFileSync(
  join(root, "docs/audits/snapshots/2026-07-31/psr-8c-governance-files-inventory.mdoc"),
  "utf8",
);
if (!doc.includes("SECURITY.md") || !doc.includes("CONTRIBUTING.md")) {
  fail("governance inventory doc incomplete");
}
if (!doc.includes("Non-goals")) fail("must state non-goals");

if (inv.ratchet.next_slice !== "PSR-8c1-governance-files-land") {
  fail("next_slice drift");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-8c-governance-files-inventory-smoke: OK — trio=${trio}/3 license_chosen=false unlicensed_pkgs=${(inv.unlicensed_packages||[]).length} next=PSR-8c1`,
);
