#!/usr/bin/env node
/**
 * PSR-7c — SBOM generator ratchet (no provenance / license-gate claim).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-7c-sbom-provenance-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-7c-sbom-provenance-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-7c-sbom-provenance-recipe") fail("wave mismatch");
if (inv.decision !== "tooling_baseline_lockfile_cdx") fail("decision mismatch");
if (!inv.policy?.forbid_provenance_attest_claim) fail("forbid_provenance required");
if (!inv.policy?.forbid_license_deny_gate_claim) fail("forbid_license_gate required");
if (inv.ratchet.provenance_complete !== false) fail("provenance must be incomplete");
if (inv.ratchet.license_gate_complete !== false) fail("license_gate must be incomplete");
if (inv.ratchet.psr7_gate_closed !== false) fail("psr7_gate_closed must be false");
if (inv.ratchet.sbom_tooling_present !== true) fail("sbom_tooling_present must be true");

for (const rel of inv.static_assets || []) {
  if (!existsSync(join(root, rel))) fail(`missing asset ${rel}`);
}

const dir = mkdtempSync(join(tmpdir(), "psr-7c-sbom-"));
const out = join(dir, "app-tour.cdx.json");
try {
  const gen = spawnSync(
    process.execPath,
    [join(root, "scripts/ops/sbom-from-pnpm-lock.mjs"), "--out", out],
    { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (gen.status !== 0) fail(`generator failed: ${gen.stderr || gen.stdout}`);
  const doc = JSON.parse(readFileSync(out, "utf8"));
  if (doc.bomFormat !== inv.generator.bom_format) fail("bomFormat drift");
  if (doc.specVersion !== inv.generator.spec_version) fail("specVersion drift");
  if (!Array.isArray(doc.components)) fail("components missing");
  if (doc.components.length < inv.generator.min_component_count) {
    fail(
      `component_count ${doc.components.length} < min ${inv.generator.min_component_count}`,
    );
  }
  const props = Object.fromEntries(
    (doc.metadata?.properties || []).map((p) => [p.name, p.value]),
  );
  if (props["psr.provenance"] !== "not_included_pending_architect_yes") {
    fail("must not claim provenance included");
  }
  if (!props["psr.lockfile_sha256"] || props["psr.lockfile_sha256"].length !== 64) {
    fail("lockfile sha256 property missing");
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const scripts = JSON.stringify(pkg.scripts || {}).toLowerCase();
if (/\bsbom\b|cyclonedx|syft/.test(scripts)) {
  fail("do not add public root sbom script without command-budget review");
}

const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
if (!gitignore.split(/\r?\n/).some((l) => l.trim() === "reports/sbom/")) {
  fail(".gitignore must ignore reports/sbom/");
}

if (inv.ratchet.next_slice !== "PSR-7d-ops-identity-design") {
  fail("next_slice drift");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-7c-sbom-provenance-smoke: OK — cdx=${inv.generator.spec_version} provenance=false license_gate=false next=PSR-7d`,
);
