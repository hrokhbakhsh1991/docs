#!/usr/bin/env node
/**
 * PSR-7b — Secret-scan baseline ratchet (tracked tip only; no history/CI claim).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-7b-secret-scan-baseline-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-7b-secret-scan-baseline-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-7b-secret-scan-baseline") fail("wave mismatch");
if (inv.decision !== "tooling_baseline_tracked_only") fail("decision mismatch");
if (!inv.policy?.forbid_history_scan_claim) fail("forbid_history_scan_claim required");
if (!inv.policy?.forbid_ci_required_check_without_yes) {
  fail("forbid_ci_required_check_without_yes required");
}
if (inv.ratchet.history_scan_complete !== false) fail("history must be incomplete");
if (inv.ratchet.ci_required_check !== false) fail("ci_required_check must be false");
if (inv.ratchet.psr7_gate_closed !== false) fail("psr7_gate_closed must be false");
if (inv.ratchet.secret_scan_tooling_present !== true) {
  fail("secret_scan_tooling_present must be true");
}

for (const rel of inv.static_assets || []) {
  if (!existsSync(join(root, rel))) fail(`missing asset ${rel}`);
}

const scan = spawnSync(
  process.execPath,
  [join(root, "scripts/ops/secret-scan-tracked-baseline.mjs"), "--json"],
  { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
if (scan.status !== 0 && scan.status !== 1) {
  fail(`scanner errored: ${scan.stderr || scan.stdout}`);
}
let report;
try {
  report = JSON.parse(scan.stdout);
} catch {
  fail("scanner --json parse failed");
}
if (report.open_count !== inv.ratchet.open_count) {
  fail(
    `open_count drift inventory=${inv.ratchet.open_count} scan=${report.open_count}`,
  );
}
if (report.open_count !== 0) {
  fail(`unallowlisted hits remain (${report.open_count})`);
}
if (report.allowlisted_count < 1) {
  fail("expected at least jwt-test-keys allowlisted hit");
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const scripts = JSON.stringify(pkg.scripts || {}).toLowerCase();
if (/gitleaks|secret-scan|secret_scan/.test(scripts)) {
  fail("do not add public root secret-scan script without Architect command budget review");
}

if (inv.ratchet.next_slice !== "PSR-7c-sbom-provenance-recipe") {
  fail("next_slice drift");
}

// Keep 7a honesty: tooling now present for tracked baseline, but R-SECRET not closed.
const sevenA = loadYaml(
  join(root, "docs/audits/snapshots/2026-07-31/psr-7a-security-release-inventory.yaml"),
);
if (sevenA.ratchet?.psr7_gate_closed === true) fail("7a must not claim gate closed");

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-7b-secret-scan-baseline-smoke: OK — open=${report.open_count} allowlisted=${report.allowlisted_count} history=false ci=false next=PSR-7c`,
);
