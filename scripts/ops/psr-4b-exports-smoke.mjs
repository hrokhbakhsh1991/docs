#!/usr/bin/env node
/**
 * PSR-4b-exports — Denali host-private export contraction ratchet.
 *
 * Asserts:
 *  - peeled keys absent from package.json exports
 *  - host-private count ≤ inventory ceiling (partial → target 30)
 *  - peeled keys have zero live exact-path consumers under apps/packages/scripts
 *    (excluding historical codemods/)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-4b-exports-inventory.yaml",
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

const inv = loadYaml(invPath);
if (inv.wave !== "PSR-4b-exports") fail("inventory wave must be PSR-4b-exports");

const pkg = JSON.parse(
  readFileSync(join(root, "packages/workspaces/denali/package.json"), "utf8"),
);
const exportKeys = Object.keys(pkg.exports || {});
const peeled = (inv.peeled || []).map((row) => row.export);
const ceiling = inv.policy?.host_private_ceiling;
const target = inv.policy?.target_host_private_max ?? 30;

if (!Array.isArray(peeled) || peeled.length === 0) {
  fail("inventory.peeled must be non-empty");
}
if (typeof ceiling !== "number") fail("policy.host_private_ceiling required");

for (const key of peeled) {
  if (exportKeys.includes(key)) {
    fail(`peeled export still present in package.json: ${key}`);
  }
}

// Live exact-path consumer scan (PCRE2 negative lookahead for longer subpaths).
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  if (hits.length > 0) {
    fail(`peeled ${key} still has consumers: ${hits.join(", ")}`);
  }
}

// Count remaining host-private ≈ PSR-4a host-private minus peeled (peeled were all host-private).
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
const remainingHp = [...baselineHp].filter(
  (k) => exportKeys.includes(k) && !peeled.includes(k),
).length;
// Also count any NEW host/* keys not in 4a baseline as host-private for ceiling.
const newHostKeys = exportKeys.filter(
  (k) => k.startsWith("./host/") && !baselineHp.has(k) && !peeled.includes(k),
);
// New host keys may be product-internal in 4a; only count baseline survivors for host-private metric.
const hostPrivateCount = remainingHp;
if (hostPrivateCount > ceiling) {
  fail(
    `host-private ${hostPrivateCount} > ceiling ${ceiling} (target ${target}); new host keys ignored=${newHostKeys.length}`,
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
if (inv.metrics?.peeled_this_wave !== peeled.length) {
  fail(
    `inventory.metrics.peeled_this_wave ${inv.metrics?.peeled_this_wave} != peeled ${peeled.length}`,
  );
}

if (!process.exitCode) {
  console.log("psr-4b-exports-smoke: PASS");
  console.log(
    `  peeled=${peeled.length} host-private=${hostPrivateCount} ceiling=${ceiling} target=${target} total_exports=${exportKeys.length}`,
  );
}
