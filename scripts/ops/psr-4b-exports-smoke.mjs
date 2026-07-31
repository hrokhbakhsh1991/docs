#!/usr/bin/env node
/**
 * PSR-4b-exports family — Denali host-private export contraction ratchet.
 *
 * Reads the latest wave inventory (PSR-4b-exports-2).
 *
 * Asserts:
 *  - cumulative peeled keys absent from package.json exports
 *  - host-private (baseline survivors + new host-private keys) ≤ ceiling
 *  - non-collapse peeled keys have zero live exact-path consumers
 *  - collapse peels keep consumers only when collapse_into export exists
 *  - allowed_new_exports are present
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-4b-exports-2-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-4b-exports-smoke: FAIL — ${msg}`);
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
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "yaml failed");
  return JSON.parse(r.stdout);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const inv = loadYaml(invPath);
if (inv.wave !== "PSR-4b-exports-2") fail("inventory wave must be PSR-4b-exports-2");

const pkg = JSON.parse(
  readFileSync(join(root, "packages/workspaces/denali/package.json"), "utf8"),
);
const exportKeys = Object.keys(pkg.exports || {});
const exportSet = new Set(exportKeys);
const peeledRows = inv.peeled || [];
const peeled = peeledRows.map((row) => row.export);
const peeledThisWave = (inv.peeled_this_wave || []).map((row) => row.export);
const ceiling = inv.policy?.host_private_ceiling;
const target = inv.policy?.target_host_private_max ?? 30;
const allowedNew = inv.policy?.allowed_new_exports || [];

if (!Array.isArray(peeled) || peeled.length === 0) {
  fail("inventory.peeled must be non-empty");
}
if (typeof ceiling !== "number") fail("policy.host_private_ceiling required");

for (const key of peeled) {
  if (exportSet.has(key)) {
    fail(`peeled export still present in package.json: ${key}`);
  }
}
for (const key of allowedNew) {
  if (!exportSet.has(key)) {
    fail(`allowed_new_exports missing from package.json: ${key}`);
  }
}

const collapseAllow = new Map();
for (const row of inv.peeled_this_wave || []) {
  if (row.allow_consumers && row.collapse_into) {
    collapseAllow.set(row.export, row.collapse_into);
  }
}
// Cumulative message collapses from peeled list
for (const row of peeledRows) {
  if (row.allow_consumers && row.collapse_into) {
    collapseAllow.set(row.export, row.collapse_into);
  }
}
// Also encode from replacement_paths for message wildcards if listed in peeled_this_wave only
for (const [exp, into] of Object.entries(inv.replacement_paths || {})) {
  if (
    typeof into === "string" &&
    into.includes("*") &&
    peeled.includes(exp) &&
    inv.policy?.allow_consumer_paths_when_collapse_into
  ) {
    if (!collapseAllow.has(exp)) collapseAllow.set(exp, into);
  }
}

for (const key of peeled) {
  const suffix = key.startsWith("./") ? key.slice(2) : key;
  const needle = `@app-tour/workspace-denali/${suffix}`;
  const r = spawnSync(
    "rg",
    ["-l", "--pcre2", "-e", `${escapeRegExp(needle)}(?!/)`, "apps", "packages", "scripts"],
    { cwd: root, encoding: "utf8" },
  );
  if (r.error) {
    fail(`rg failed: ${r.error.message}`);
    continue;
  }
  const hits = (r.stdout || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => !f.includes("codemods/") && !f.includes("/dist/"));
  if (hits.length === 0) continue;
  const into = collapseAllow.get(key);
  if (into && exportSet.has(into)) {
    continue; // consumers served by replacement export
  }
  fail(`peeled ${key} still has consumers: ${hits.join(", ")}`);
}

const classPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-4a-denali-export-classification.yaml",
);
const klass = loadYaml(classPath);
const baselineHp = new Set(
  (klass.exports || [])
    .filter((row) => row.class === "host-private")
    .map((row) => row.export),
);
const remainingHp = [...baselineHp].filter((k) => exportSet.has(k)).length;
const newHostPrivate = allowedNew.filter((k) => exportSet.has(k)).length;
const hostPrivateCount = remainingHp + newHostPrivate;

if (hostPrivateCount > ceiling) {
  fail(
    `host-private ${hostPrivateCount} > ceiling ${ceiling} (target ${target}; remaining=${remainingHp} new=${newHostPrivate})`,
  );
}

if (inv.metrics?.host_private !== hostPrivateCount) {
  fail(
    `inventory.metrics.host_private ${inv.metrics?.host_private} != live ${hostPrivateCount}`,
  );
}
if (inv.metrics?.total_exports !== exportKeys.length) {
  fail(
    `inventory.metrics.total_exports ${inv.metrics?.total_exports} != live ${exportKeys.length}`,
  );
}
if (inv.metrics?.peeled_this_wave !== peeledThisWave.length) {
  fail(
    `inventory.metrics.peeled_this_wave ${inv.metrics?.peeled_this_wave} != ${peeledThisWave.length}`,
  );
}

if (!process.exitCode) {
  console.log("psr-4b-exports-smoke: PASS");
  console.log(
    `  wave=${inv.wave} peeled_cumulative=${peeled.length} peeled_this_wave=${peeledThisWave.length} host-private=${hostPrivateCount}/${ceiling} target=${target} total_exports=${exportKeys.length}`,
  );
}
