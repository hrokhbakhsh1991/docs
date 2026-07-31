#!/usr/bin/env node
/**
 * PSR-4b-http-alias — forbid bare @app-tour/workspace-{denali,urban}/http in code.
 * Require tsconfig host/http paths; forbid bare /http path aliases.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-4b-http-alias-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-4b-http-alias-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-4b-http-alias") fail("inventory wave must be PSR-4b-http-alias");

const ceiling = inv.policy?.bare_http_code_ceiling;
if (typeof ceiling !== "number") fail("policy.bare_http_code_ceiling required");

const rg = spawnSync(
  "rg",
  [
    "-n",
    "--pcre2",
    "-e",
    "@app-tour/workspace-(denali|urban)/http(?!/)",
    "apps",
    "packages",
    "scripts",
  ],
  { cwd: root, encoding: "utf8" },
);
if (rg.error) fail(`rg failed: ${rg.error.message}`);
const hits = (rg.stdout || "")
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((l) => !l.includes("/dist/") && !l.includes("node_modules"));
if (hits.length > ceiling) {
  fail(`bare /http code hits ${hits.length} > ceiling ${ceiling}:\n  ${hits.join("\n  ")}`);
}
if ((inv.metrics?.bare_http_code_hits ?? -1) !== hits.length) {
  fail(
    `metrics.bare_http_code_hits ${inv.metrics?.bare_http_code_hits} != live ${hits.length}`,
  );
}

const tsconfig = JSON.parse(
  readFileSync(join(root, "apps/api/tsconfig.json"), "utf8"),
);
const paths = tsconfig.compilerOptions?.paths || {};
for (const key of inv.tsconfig_removed || []) {
  if (Object.prototype.hasOwnProperty.call(paths, key)) {
    fail(`tsconfig still has removed bare alias: ${key}`);
  }
}
for (const key of inv.tsconfig_retained || []) {
  if (!Object.prototype.hasOwnProperty.call(paths, key)) {
    fail(`tsconfig missing required host/http path: ${key}`);
  }
}

if ((inv.metrics?.retargeted_files ?? -1) !== (inv.retargeted || []).length) {
  fail(
    `metrics.retargeted_files ${inv.metrics?.retargeted_files} != ${ (inv.retargeted || []).length}`,
  );
}

if (!process.exitCode) {
  console.log("psr-4b-http-alias-smoke: PASS");
  console.log(
    `  bare_http_code_hits=${hits.length}/${ceiling} retargeted_files=${(inv.retargeted || []).length}`,
  );
}
