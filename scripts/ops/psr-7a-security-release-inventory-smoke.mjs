#!/usr/bin/env node
/**
 * PSR-7a — Security/release readiness inventory ratchet (no live YES).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-7a-security-release-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-7a-security-release-inventory-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-7a-security-release-inventory") fail("wave mismatch");
if (inv.decision !== "inventory_recipe_only") fail("decision mismatch");
if (!inv.policy?.forbid_full_gate_in_this_wave) fail("forbid_full_gate required");
if (!inv.policy?.forbid_claiming_psr7_gate_closed) fail("forbid_psr7_closed required");
if (!inv.policy?.harbor_remains_stub) fail("harbor_remains_stub required");
if (!inv.policy?.live_proof_requires_architect_yes) fail("YES policy required");

if (inv.ratchet.secret_scan_tooling_present !== false) {
  fail("secret_scan_tooling_present must be false until tooling lands");
}
if (inv.ratchet.sbom_tooling_present !== false) {
  fail("sbom_tooling_present must be false until tooling lands");
}
if (inv.ratchet.ops_identity_is_short_lived !== false) {
  fail("ops identity must still be shared bearer");
}
if (inv.ratchet.psr7_gate_closed !== false) fail("psr7_gate_closed must be false");
if (inv.ratchet.harbor_tier !== "stub") fail("harbor_tier must be stub");

const families = inv.exit_criteria || [];
if (families.length !== inv.ratchet.family_count) fail("family_count drift");
const required = [
  "R-OPS-ID",
  "R-BRANCH",
  "R-STAGING",
  "R-SECRET",
  "R-SBOM",
  "R-EVIDENCE",
];
const ids = new Set(families.map((f) => f.id));
for (const id of required) {
  if (!ids.has(id)) fail(`missing family ${id}`);
}

let missing = 0;
for (const fam of families) {
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

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const scripts = pkg.scripts || {};
const scriptBlob = JSON.stringify(scripts).toLowerCase();
if (/gitleaks|trivy|secret-scan|secret_scan/.test(scriptBlob)) {
  fail("package.json gained secret-scan script — update inventory ratchet");
}
if (/syft|cyclonedx|\\bsbom\\b/.test(scriptBlob)) {
  fail("package.json gained sbom script — update inventory ratchet");
}

const bearer = readFileSync(
  join(root, "apps/api/src/platform/read-platform-ops-bearer-token.ts"),
  "utf8",
);
if (!bearer.includes("PLATFORM_OPS_BEARER_TOKEN")) {
  fail("bearer reader missing env contract");
}
if (!bearer.includes("DEFAULT_DEV_BEARER") && !bearer.includes("platform-ops")) {
  fail("expected shared/dev bearer model still present");
}

const harborManifest = JSON.parse(
  readFileSync(
    join(root, "packages/workspaces/harbor/workspace.manifest.json"),
    "utf8",
  ),
);
if (harborManifest?.guestConformance?.productionTier !== "stub") {
  fail("Harbor must remain stub during PSR-7a");
}

if (inv.ratchet.next_slice !== "PSR-7b-secret-scan-baseline") {
  fail("next_slice drift");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-7a-security-release-inventory-smoke: OK — families=${inv.ratchet.family_count} secret=missing sbom=missing ops=shared_bearer harbor=stub next=PSR-7b`,
);
