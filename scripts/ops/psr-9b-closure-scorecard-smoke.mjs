#!/usr/bin/env node
/**
 * PSR-9b — Expanded scorecard ratchet (never claims PSR-9 / program closed).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-9b-closure-scorecard.yaml",
);

function fail(msg) {
  console.error(`psr-9b-closure-scorecard-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-9b-scorecard-collectors-expand") fail("wave mismatch");
if (inv.decision !== "collectors_expanded_measure_only") fail("decision mismatch");
if (!inv.policy?.forbid_claiming_psr9_closed) fail("forbid_psr9_closed required");
if (inv.ratchet.psr9_closed !== false) fail("psr9_closed must be false");
if (inv.ratchet.program_closed !== false) fail("program_closed must be false");
if ((inv.metrics || []).length !== inv.ratchet.metric_count) fail("metric_count drift");

const required = [
  "dirty_worktree_records",
  "absolute_local_doc_links",
  "denali_package_exports",
  "governance_files_present",
  "harbor_stub_honest",
];
const ids = new Set((inv.metrics || []).map((m) => m.id));
for (const id of required) {
  if (!ids.has(id)) fail(`missing metric ${id}`);
}

for (const rel of inv.static_assets || []) {
  if (!existsSync(join(root, rel))) fail(`missing asset ${rel}`);
}

const collect = spawnSync(
  process.execPath,
  [
    join(root, "scripts/ops/psr-9-closure-scorecard-collect.mjs"),
    "--scorecard",
    "docs/audits/snapshots/2026-07-31/psr-9b-closure-scorecard.yaml",
    "--json",
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
if (collect.status !== 0) fail(`collector failed: ${collect.stderr || collect.stdout}`);
const lines = (collect.stdout || "").trim().split(/\n/);
const report = JSON.parse(lines[lines.length - 1]);
if (report.psr9_closed !== false) fail("collector must set psr9_closed false");
if (report.rows.length !== inv.ratchet.metric_count) fail("report metric count drift");

const byId = Object.fromEntries(report.rows.map((r) => [r.id, r]));
for (const id of required) {
  if (byId[id]?.measured === null || byId[id]?.measured === undefined) {
    fail(`collector returned null for ${id}`);
  }
}
if (byId.harbor_stub_honest?.measured !== 1) {
  fail("harbor must remain stub-honest until PSR-6c6 promote");
}
if (byId.secret_scan_tooling?.meets_target !== true) {
  fail("secret_scan_tooling should meet target after PSR-7b");
}
if (byId.sbom_tooling?.meets_target !== true) {
  fail("sbom_tooling should meet target after PSR-7c");
}

// 9a historical smoke still works with frozen yaml
const nineA = spawnSync(
  process.execPath,
  [
    join(root, "scripts/ops/psr-9-closure-scorecard-collect.mjs"),
    "--scorecard",
    "docs/audits/snapshots/2026-07-31/psr-9a-closure-scorecard.yaml",
    "--json",
  ],
  { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
if (nineA.status !== 0) fail(`9a scorecard collect regress: ${nineA.stderr || nineA.stdout}`);

if (inv.ratchet.next_slice !== "PSR-8b-legacy-import-ratchet") fail("next_slice drift");

if (process.exitCode) process.exit(process.exitCode);
const meet = report.rows.filter((r) => r.meets_target).length;
console.log(
  `psr-9b-closure-scorecard-smoke: OK — metrics=${report.rows.length} meeting=${meet} dirty=${byId.dirty_worktree_records.measured} abs_docs=${byId.absolute_local_doc_links.measured} denali_exports=${byId.denali_package_exports.measured} next=PSR-8b`,
);
