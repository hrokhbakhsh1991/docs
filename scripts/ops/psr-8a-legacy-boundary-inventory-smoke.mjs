#!/usr/bin/env node
/**
 * PSR-8a — Legacy/publication boundary inventory ratchet (no extract / no license).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-8a-legacy-boundary-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-8a-legacy-boundary-inventory-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-8a-legacy-boundary-inventory") fail("wave mismatch");
if (inv.decision !== "inventory_recipe_only") fail("decision mismatch");
if (!inv.policy?.forbid_legacy_tree_delete_in_this_wave) fail("forbid delete required");
if (!inv.policy?.forbid_license_choice_in_this_wave) fail("forbid license choice required");
if (inv.ratchet.psr8_gate_closed !== false) fail("psr8_gate_closed must be false");
if ((inv.families || []).length !== inv.ratchet.family_count) fail("family_count drift");

for (const rel of inv.static_assets || []) {
  if (!existsSync(join(root, rel))) fail(`missing asset ${rel}`);
}

const legacyDir = join(root, "legacy");
if (!statSync(legacyDir).isDirectory()) fail("legacy/ missing");
if (inv.findings.legacy_tree_present !== true) fail("legacy_tree_present drift");
if (inv.ratchet.legacy_tree_present !== true) fail("ratchet legacy_tree_present drift");

if (existsSync(join(root, "LICENSE")) || existsSync(join(root, "LICENSE.md"))) {
  fail("LICENSE appeared — update inventory findings");
}
if (inv.findings.root_license_present !== false) fail("root_license_present drift");
if (inv.ratchet.root_license_present !== false) fail("ratchet root_license drift");

if (existsSync(join(root, "SECURITY.md"))) fail("SECURITY.md appeared — update inventory");
if (existsSync(join(root, "CONTRIBUTING.md"))) {
  fail("CONTRIBUTING.md appeared — update inventory");
}

const depcruise = readFileSync(join(root, "dependency-cruiser.config.js"), "utf8");
if (!depcruise.includes("no-legacy-imports")) fail("depcruise missing no-legacy-imports");
if (!depcruise.includes('path: "^legacy"')) fail("depcruise missing ^legacy ban");

const denaliLegacyTypes = join(
  root,
  "packages/workspaces/denali/src/types/legacy",
);
if (!statSync(denaliLegacyTypes).isDirectory()) {
  fail("denali types/legacy folder missing — update honesty note");
}
if (inv.findings.denali_in_package_types_legacy_present !== true) {
  fail("denali_in_package_types_legacy_present drift");
}

// Spot-check: no apps/api|web src import from repo-root legacy/
const importProbe = spawnSync(
  "rg",
  [
    "-n",
    String.raw`from ['"].*[/\\]legacy[/\\]|from ['"]legacy[/\\]`,
    "apps/api/src",
    "apps/web/src",
    "apps/portal/src",
    "apps/marketing/src",
    "packages/workspace-sdk/src",
    "packages/platform-core/src",
  ],
  { cwd: root, encoding: "utf8" },
);
// rg exit 1 = no matches (good); 0 = hits (bad for runtime isolation claim)
if (importProbe.status === 0 && (importProbe.stdout || "").trim()) {
  fail(`repo-legacy import hit in app/sdk/core src:\n${importProbe.stdout}`);
}
if (importProbe.status !== 0 && importProbe.status !== 1) {
  fail(`rg probe failed status=${importProbe.status}`);
}
if (inv.ratchet.runtime_repo_legacy_import_clean !== true) {
  fail("runtime_repo_legacy_import_clean must be true");
}

if (inv.ratchet.next_slice !== "PSR-8b-legacy-import-ratchet") fail("next_slice drift");

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-8a-legacy-boundary-inventory-smoke: OK — legacy≈${inv.findings.legacy_tree_size_mb_approx}MB license=missing runtime_import_clean=true next=PSR-8b`,
);
