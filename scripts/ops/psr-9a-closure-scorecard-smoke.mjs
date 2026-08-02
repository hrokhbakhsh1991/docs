#!/usr/bin/env node
/**
 * PSR-9a — Scorecard scaffold ratchet (never claims PSR-9 / program closed).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-9a-closure-scorecard.yaml",
);

function fail(msg) {
  console.error(`psr-9a-closure-scorecard-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-9a-closure-scorecard-scaffold") fail("wave mismatch");
if (inv.decision !== "scorecard_scaffold_only") fail("decision mismatch");
if (!inv.policy?.forbid_claiming_psr9_closed) fail("forbid_psr9_closed required");
if (!inv.policy?.forbid_claiming_program_closed) fail("forbid_program_closed required");
if (inv.ratchet.psr9_closed !== false) fail("psr9_closed must be false");
if (inv.ratchet.program_closed !== false) fail("program_closed must be false");
if ((inv.metrics || []).length !== inv.ratchet.metric_count) fail("metric_count drift");

for (const rel of inv.static_assets || []) {
  if (!existsSync(join(root, rel))) fail(`missing asset ${rel}`);
}

const collect = spawnSync(
  process.execPath,
  [
    join(root, "scripts/ops/psr-9-closure-scorecard-collect.mjs"),
    "--scorecard",
    "docs/audits/snapshots/2026-07-31/psr-9a-closure-scorecard.yaml",
    "--json",
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
if (collect.status !== 0) fail(`collector failed: ${collect.stderr || collect.stdout}`);
const lines = (collect.stdout || "").trim().split(/\n/);
const report = JSON.parse(lines[lines.length - 1]);
if (report.psr9_closed !== false) fail("collector must set psr9_closed false");
if (report.program_closed !== false) fail("collector must set program_closed false");
if (report.meets_all_targets === true) {
  // Extremely unlikely today; if true, still do not claim closed without Architect.
  console.warn(
    "psr-9a-closure-scorecard-smoke: WARN — all measured targets met; still not claiming PSR-9 closed",
  );
}

const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
if (!gitignore.split(/\r?\n/).some((l) => l.trim() === "reports/psr/")) {
  fail(".gitignore must ignore reports/psr/");
}

if (inv.ratchet.next_slice !== "PSR-9b-scorecard-collectors-expand") {
  fail("next_slice drift");
}

if (process.exitCode) process.exit(process.exitCode);
const meet = (report.rows || []).filter((r) => r.meets_target).length;
console.log(
  `psr-9a-closure-scorecard-smoke: OK — metrics=${report.rows.length} meeting=${meet} psr9_closed=false next=PSR-9b`,
);
