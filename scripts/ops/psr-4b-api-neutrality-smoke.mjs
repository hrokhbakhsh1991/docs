#!/usr/bin/env node
/**
 * PSR-4b family — ratchet smoke for API product defaults + host-source ceiling.
 *
 * Host-source = branded denali/urban/harbor imports outside:
 *   - *.generated.ts
 *   - specs / test/
 *   - http/configure-* product adapters
 *   - explicitly approved settings-contract files (inventory allowlist)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const apiSrc = join(root, "apps/api/src");

/** Unapproved host-source branded files (must stay zero after PSR-4b-host-imports-close). */
const HOST_SOURCE_UNAPPROVED_CEILING = 0;
/** After PSR-4b-defaults: zero `workspaceType ?? "denali"` in apps/api/src. */
const PRODUCT_DEFAULT_CEILING = 0;

/**
 * Approved settings-contract imports — stable `./settings/*` package exports, not `./host/*`.
 * @see docs/dev/denali-plugin-encapsulation.mdoc
 */
const APPROVED_SETTINGS_CONTRACT_FILES = Object.freeze([
  "apps/api/src/settings/parse-equipment-icon-key.ts",
]);

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

const approvedSet = new Set(APPROVED_SETTINGS_CONTRACT_FILES);
const defaultHits = [];
const unapprovedHostSource = new Set();
const approvedHostSource = new Set();

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
  if (!IMPORT_RE.test(text)) continue;
  if (approvedSet.has(rel)) {
    approvedHostSource.add(rel);
  } else {
    unapprovedHostSource.add(rel);
  }
}

if (defaultHits.length > PRODUCT_DEFAULT_CEILING) {
  fail(
    `product-default sites ${defaultHits.length} > ceiling ${PRODUCT_DEFAULT_CEILING}: ${defaultHits.join(", ")}`,
  );
}

if (unapprovedHostSource.size > HOST_SOURCE_UNAPPROVED_CEILING) {
  fail(
    `unapproved host-source branded files ${unapprovedHostSource.size} > ceiling ${HOST_SOURCE_UNAPPROVED_CEILING}: ${[...unapprovedHostSource].sort().join(", ")}`,
  );
}

for (const expected of APPROVED_SETTINGS_CONTRACT_FILES) {
  if (!approvedHostSource.has(expected)) {
    fail(`approved settings-contract missing branded import (or file moved): ${expected}`);
  }
}
for (const found of approvedHostSource) {
  if (!approvedSet.has(found)) {
    fail(`unexpected approved settings-contract hit: ${found}`);
  }
}

const inv = loadYaml(
  join(root, "docs/audits/snapshots/2026-07-31/psr-4b-api-neutrality-inventory.yaml"),
);
const ALLOWED_WAVES = new Set([
  "PSR-4b",
  "PSR-4b-defaults",
  "PSR-4b-host-imports",
  "PSR-4b-host-imports-2",
  "PSR-4b-host-imports-3",
  "PSR-4b-host-imports-4",
  "PSR-4b-host-imports-5",
  "PSR-4b-host-imports-close",
]);
if (!ALLOWED_WAVES.has(inv.wave)) {
  fail("inventory wave must be PSR-4b*");
}
if ((inv.product_defaults || []).length !== PRODUCT_DEFAULT_CEILING) {
  fail(
    `inventory product_defaults length ${(inv.product_defaults || []).length} != ceiling ${PRODUCT_DEFAULT_CEILING}`,
  );
}
if ((inv.metrics?.host_source_unapproved_ceiling ?? -1) !== HOST_SOURCE_UNAPPROVED_CEILING) {
  fail(
    `inventory host_source_unapproved_ceiling ${inv.metrics?.host_source_unapproved_ceiling} != ${HOST_SOURCE_UNAPPROVED_CEILING}`,
  );
}
if ((inv.metrics?.approved_settings_contract_files ?? -1) !== APPROVED_SETTINGS_CONTRACT_FILES.length) {
  fail(
    `inventory approved_settings_contract_files ${inv.metrics?.approved_settings_contract_files} != ${APPROVED_SETTINGS_CONTRACT_FILES.length}`,
  );
}

if (!process.exitCode) {
  console.log("psr-4b-smoke: PASS");
  console.log(`  product-defaults: ${defaultHits.length}/${PRODUCT_DEFAULT_CEILING}`);
  console.log(
    `  host-source unapproved: ${unapprovedHostSource.size}/${HOST_SOURCE_UNAPPROVED_CEILING}`,
  );
  console.log(
    `  approved settings-contract: ${approvedHostSource.size}/${APPROVED_SETTINGS_CONTRACT_FILES.length}`,
  );
  console.log(`  inventory branded_imports: ${(inv.branded_imports || []).length}`);
}
