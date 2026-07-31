#!/usr/bin/env node
/**
 * PSR-4b / PSR-4b-defaults — ratchet smoke for API product defaults + host-source ceiling.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const apiSrc = join(root, "apps/api/src");

const HOST_SOURCE_FILE_CEILING = 11;
/** After PSR-4b-defaults: zero `workspaceType ?? "denali"` in apps/api/src. */
const PRODUCT_DEFAULT_CEILING = 0;

function fail(msg) {
  console.error(`psr-4b-smoke: FAIL — ${msg}`);
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
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "yaml failed");
  return JSON.parse(r.stdout);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walk(p, out);
    } else if (/\.(ts|tsx|mjs|js)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const DEFAULT_RE = /workspaceType\s*\?\?\s*["']denali["']/;
const IMPORT_RE =
  /from\s+["'](@app-tour\/workspace-(?:denali|urban|harbor)(?:\/[^"']*)?)["']|import\(\s*["'](@app-tour\/workspace-(?:denali|urban|harbor)(?:\/[^"']*)?)["']\s*\)/;

const defaultHits = [];
const hostSourceFiles = new Set();

for (const abs of walk(apiSrc)) {
  const rel = relative(root, abs).split("\\").join("/");
  const text = readFileSync(abs, "utf8");
  if (DEFAULT_RE.test(text)) {
    defaultHits.push(rel);
  }
  const isGenerated = abs.endsWith(".generated.ts");
  const isTest = /\.spec\.tsx?$/.test(abs) || rel.includes("/test/");
  const isAdapter = /\/http\/configure-/.test(rel);
  if (isGenerated || isTest || isAdapter) continue;
  if (IMPORT_RE.test(text)) {
    hostSourceFiles.add(rel);
  }
}

if (defaultHits.length > PRODUCT_DEFAULT_CEILING) {
  fail(
    `product-default sites ${defaultHits.length} > ceiling ${PRODUCT_DEFAULT_CEILING}: ${defaultHits.join(", ")}`,
  );
}

if (hostSourceFiles.size > HOST_SOURCE_FILE_CEILING) {
  fail(
    `host-source branded files ${hostSourceFiles.size} > ceiling ${HOST_SOURCE_FILE_CEILING}: ${[...hostSourceFiles].sort().join(", ")}`,
  );
}

const inv = loadYaml(
  join(root, "docs/audits/snapshots/2026-07-31/psr-4b-api-neutrality-inventory.yaml"),
);
if (inv.wave !== "PSR-4b" && inv.wave !== "PSR-4b-defaults") {
  fail("inventory wave must be PSR-4b*");
}
if ((inv.product_defaults || []).length !== PRODUCT_DEFAULT_CEILING) {
  fail(
    `inventory product_defaults length ${(inv.product_defaults || []).length} != ceiling ${PRODUCT_DEFAULT_CEILING}`,
  );
}

if (!process.exitCode) {
  console.log("psr-4b-smoke: PASS");
  console.log(`  product-defaults: ${defaultHits.length}/${PRODUCT_DEFAULT_CEILING}`);
  console.log(`  host-source files: ${hostSourceFiles.size}/${HOST_SOURCE_FILE_CEILING}`);
  console.log(`  inventory branded_imports: ${(inv.branded_imports || []).length}`);
}
