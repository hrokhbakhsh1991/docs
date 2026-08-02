#!/usr/bin/env node
/**
 * PSR-8b — Legacy import ratchet (no extract / no Denali rename execution).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-8b-legacy-import-ratchet-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-8b-legacy-import-ratchet-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-8b-legacy-import-ratchet") fail("wave mismatch");
if (inv.decision !== "import_ratchet_plus_rename_plan_only") fail("decision mismatch");
if (!inv.policy?.forbid_denali_types_rename_in_this_wave) {
  fail("forbid_denali_types_rename required");
}
if (!inv.policy?.forbid_legacy_tree_delete_in_this_wave) fail("forbid delete required");
if (inv.ratchet.psr8_gate_closed !== false) fail("psr8_gate_closed must be false");
if (inv.ratchet.denali_types_legacy_renamed !== false) {
  fail("denali_types_legacy_renamed must be false in this wave");
}
if (inv.ratchet.legacy_tree_present !== true) fail("legacy_tree_present must be true");

for (const rel of inv.static_assets || []) {
  if (!existsSync(join(root, rel))) fail(`missing asset ${rel}`);
}

const depcruise = readFileSync(join(root, "dependency-cruiser.config.js"), "utf8");
if (!depcruise.includes("no-legacy-imports")) fail("missing no-legacy-imports rule");
if (!depcruise.includes('path: "^legacy"')) fail("missing ^legacy ban");

const guard = readFileSync(join(root, "scripts/guards/import-boundary-ast.mjs"), "utf8");
if (!guard.includes("legacy")) fail("import-boundary guard missing legacy ban");

// Repo-root legacy import probe (apps + core sdk/platform-core src only)
const probePaths = [
  "apps/api/src",
  "apps/web/src",
  "apps/portal/src",
  "apps/marketing/src",
  "packages/workspace-sdk/src",
  "packages/platform-core/src",
];
const importProbe = spawnSync(
  "rg",
  [
    "-n",
    // Match import/export/require of repo-root legacy tree, not denali src/types/legacy
    String.raw`from\s+['"][^'"]*(?:^|[/\\])legacy[/\\]`,
    ...probePaths,
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);
if (importProbe.status === 0 && (importProbe.stdout || "").trim()) {
  // Filter false positives: comments mentioning legacy/apps paths are ok if not import.
  // Pattern requires from '...legacy/' — still filter denali relative types/legacy
  const lines = (importProbe.stdout || "")
    .split(/\n/)
    .filter(Boolean)
    .filter((line) => !/types\/legacy/.test(line))
    .filter((line) => !/workspaces\/denali/.test(line));
  if (lines.length) {
    fail(`repo-legacy import hit:\n${lines.join("\n")}`);
  }
} else if (importProbe.status !== 0 && importProbe.status !== 1) {
  fail(`rg probe failed status=${importProbe.status}`);
}

if (inv.ratchet.runtime_repo_legacy_import_clean !== true) {
  fail("runtime_repo_legacy_import_clean drift");
}

const legacyTypesDir = join(
  root,
  "packages/workspaces/denali/src/types/legacy",
);
if (!statSync(legacyTypesDir).isDirectory()) {
  fail("denali types/legacy missing — update rename plan wave");
}
const modules = readdirSync(legacyTypesDir).filter((f) => f.endsWith(".ts"));
if (modules.length !== inv.findings.denali_types_legacy_module_count) {
  fail(
    `denali legacy module count drift got=${modules.length} want=${inv.findings.denali_types_legacy_module_count}`,
  );
}
for (const rel of inv.rename_plan_modules || []) {
  if (!existsSync(join(root, rel))) fail(`rename plan module missing: ${rel}`);
}

const planDoc = readFileSync(
  join(root, "docs/audits/snapshots/2026-07-31/psr-8b-legacy-import-ratchet.mdoc"),
  "utf8",
);
if (!planDoc.includes("PSR-8b1") || !planDoc.includes("types/legacy")) {
  fail("rename plan doc incomplete");
}

if (inv.ratchet.next_slice !== "PSR-8b1-denali-types-legacy-rename") {
  fail("next_slice drift");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-8b-legacy-import-ratchet-smoke: OK — runtime_import_clean=true denali_types_legacy=${modules.length} renamed=false next=PSR-8b1`,
);
