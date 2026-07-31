#!/usr/bin/env node
/**
 * PSR-4a — validate Denali export classification YAML vs package.json.
 * Classification-only: does not modify exports.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const TAXONOMY = new Set([
  "public-contract",
  "host-private",
  "test-only",
  "compatibility",
  "product-internal",
]);

function fail(msg) {
  console.error(`psr-4a-smoke: FAIL — ${msg}`);
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
    maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || "yaml parse failed");
  }
  return JSON.parse(r.stdout);
}

const pkg = JSON.parse(
  readFileSync(join(root, "packages/workspaces/denali/package.json"), "utf8"),
);
const exportKeys = Object.keys(pkg.exports || {});
const inv = loadYaml(
  join(root, "docs/audits/snapshots/2026-07-31/psr-4a-denali-export-classification.yaml"),
);

if (inv.wave !== "PSR-4a") fail("inventory wave must be PSR-4a");
if (!inv.policy?.classification_only) fail("policy.classification_only must be true");
if (!inv.policy?.no_export_deletion_in_this_wave) {
  fail("policy.no_export_deletion_in_this_wave must be true");
}

const rows = inv.exports || [];
if (rows.length !== exportKeys.length) {
  fail(`row count ${rows.length} != package exports ${exportKeys.length}`);
}

const seen = new Set();
const summary = Object.create(null);
for (const row of rows) {
  if (!row?.export || !row?.class) {
    fail("row missing export/class");
    continue;
  }
  if (seen.has(row.export)) fail(`duplicate export row: ${row.export}`);
  seen.add(row.export);
  if (!TAXONOMY.has(row.class)) fail(`bad class ${row.class} for ${row.export}`);
  summary[row.class] = (summary[row.class] || 0) + 1;
}

for (const key of exportKeys) {
  if (!seen.has(key)) fail(`package export missing from inventory: ${key}`);
}
for (const key of seen) {
  if (!exportKeys.includes(key)) fail(`inventory export not in package.json: ${key}`);
}

const claimed = inv.summary || {};
for (const cls of TAXONOMY) {
  const a = claimed[cls] || 0;
  const b = summary[cls] || 0;
  if (a !== b) fail(`summary.${cls} claimed ${a} but rows have ${b}`);
}

const urban = Object.keys(
  JSON.parse(readFileSync(join(root, "packages/workspaces/urban/package.json"), "utf8")).exports || {},
).length;
const harbor = Object.keys(
  JSON.parse(readFileSync(join(root, "packages/workspaces/harbor/package.json"), "utf8")).exports || {},
).length;
if (inv.policy?.reference_workspaces?.urban !== urban) {
  fail(`reference urban exports drifted (doc ${inv.policy?.reference_workspaces?.urban} vs ${urban})`);
}
if (inv.policy?.reference_workspaces?.harbor !== harbor) {
  fail(`reference harbor exports drifted (doc ${inv.policy?.reference_workspaces?.harbor} vs ${harbor})`);
}

if (!process.exitCode) {
  console.log("psr-4a-smoke: PASS");
  console.log(`  denali exports classified: ${rows.length}`);
  console.log(
    `  public-contract=${summary["public-contract"] || 0} host-private=${summary["host-private"] || 0} test-only=${summary["test-only"] || 0} product-internal=${summary["product-internal"] || 0}`,
  );
  console.log(`  reference urban=${urban} harbor=${harbor}`);
}
