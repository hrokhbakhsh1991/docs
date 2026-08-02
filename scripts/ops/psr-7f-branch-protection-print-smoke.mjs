#!/usr/bin/env node
/**
 * PSR-7f — Branch-protection print + local name-drift ratchet (no gh verify/apply).
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-7f-branch-protection-print-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-7f-branch-protection-print-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-7f-branch-protection-print-ratchet") fail("wave mismatch");
if (inv.decision !== "print_and_local_drift_only") fail("decision mismatch");
if (!inv.policy?.forbid_gh_branch_protection_apply_in_this_wave) {
  fail("forbid apply required");
}
if (!inv.policy?.forbid_gh_branch_protection_verify_without_yes) {
  fail("forbid verify without YES required");
}
if (inv.ratchet.live_verify_complete !== false) fail("live_verify must be false");
if (inv.ratchet.r_branch_closed !== false) fail("r_branch_closed must be false");

for (const rel of inv.static_assets || []) {
  if (!existsSync(join(root, rel))) fail(`missing asset ${rel}`);
}

const checksMod = await import(
  pathToFileURL(join(root, "scripts/ops/main-branch-required-checks.mjs")).href,
);
const listed = checksMod.MAIN_BRANCH_REQUIRED_CHECKS;
if (!Array.isArray(listed)) fail("MAIN_BRANCH_REQUIRED_CHECKS missing");
if (listed.length !== inv.ratchet.required_check_count) {
  fail(`required_check_count drift got=${listed.length}`);
}
for (const name of inv.expected_required_checks || []) {
  if (!listed.includes(name)) fail(`missing expected check: ${name}`);
}

const print = spawnSync(
  process.execPath,
  [join(root, "scripts/ops/configure-main-branch-protection.mjs"), "--print-only"],
  { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);
if (print.status !== 0) fail(`print-only failed: ${print.stderr || print.stdout}`);
for (const name of inv.expected_required_checks || []) {
  if (!(print.stdout || "").includes(name)) {
    fail(`print-only output missing ${name}`);
  }
}

const drift = spawnSync(
  process.execPath,
  [join(root, "scripts/ops/verify-required-check-names.mjs")],
  { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);
if (drift.status !== 0) {
  fail(`local name drift: ${drift.stderr || drift.stdout}`);
}

if (inv.ratchet.next_slice !== "PSR-7g-tip-rc-evidence-draft") {
  fail("next_slice drift");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-7f-branch-protection-print-smoke: OK — checks=${listed.length} print=ok drift=clean live_verify=false next=PSR-7g`,
);
