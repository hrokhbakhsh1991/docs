#!/usr/bin/env node
/**
 * PSR-4b-api-deps / PSR-4b-api-deps-sync — ratchet apps/api workspace product
 * membership vs manifests + generate/sync writer verify.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SDK = "@app-tour/workspace-sdk";
/** Product workspace deps in apps/api (excludes sdk). */
const API_PRODUCT_DEP_CEILING = 12;

function fail(msg) {
  console.error(`psr-4b-api-deps-smoke: FAIL — ${msg}`);
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

function collectProductDeps(pkg) {
  const names = new Set();
  for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
    const block = pkg[section];
    if (!block || typeof block !== "object") continue;
    for (const name of Object.keys(block)) {
      if (name.startsWith("@app-tour/workspace-") && name !== SDK) names.add(name);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function manifestPackages() {
  const dir = join(root, "packages/workspaces");
  const out = new Set();
  for (const name of readdirSync(dir)) {
    try {
      const m = JSON.parse(readFileSync(join(dir, name, "workspace.manifest.json"), "utf8"));
      if (typeof m.package === "string" && m.package.length > 0) out.add(m.package);
    } catch {
      /* skip */
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

const apiPkg = JSON.parse(readFileSync(join(root, "apps/api/package.json"), "utf8"));
const declared = collectProductDeps(apiPkg);
const expected = manifestPackages();
const orphans = declared.filter((n) => !expected.includes(n));
const missing = expected.filter((n) => !declared.includes(n));

if (orphans.length) fail(`orphan api product deps: ${orphans.join(", ")}`);
if (missing.length) fail(`missing api product deps: ${missing.join(", ")}`);
if (declared.length > API_PRODUCT_DEP_CEILING) {
  fail(`api product deps ${declared.length} > ceiling ${API_PRODUCT_DEP_CEILING}`);
}
if (declared.length !== expected.length) {
  fail(`api product deps count ${declared.length} != manifest count ${expected.length}`);
}

const inv = loadYaml(
  join(root, "docs/audits/snapshots/2026-07-31/psr-4b-api-deps-sync-inventory.yaml"),
);
if (inv.wave !== "PSR-4b-api-deps-sync") fail("inventory wave must be PSR-4b-api-deps-sync");
if (!inv.policy?.generate_sync_writer) fail("policy.generate_sync_writer must be true");
if ((inv.metrics?.api_product_deps ?? -1) !== declared.length) {
  fail(`inventory metrics.api_product_deps ${inv.metrics?.api_product_deps} != ${declared.length}`);
}
if ((inv.metrics?.manifest_packages ?? -1) !== expected.length) {
  fail(
    `inventory metrics.manifest_packages ${inv.metrics?.manifest_packages} != ${expected.length}`,
  );
}

const guard = spawnSync("node", [join(root, "scripts/guards/guard-host-workspace-deps.mjs")], {
  cwd: root,
  encoding: "utf8",
});
if (guard.status !== 0) {
  fail(`guard-host-workspace-deps failed:\n${guard.stderr || guard.stdout}`);
}

const check = spawnSync(
  "node",
  [join(root, "scripts/generate-workspace-registry.mjs"), "--check"],
  { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
);
if (check.status !== 0) {
  fail(`generate:workspace-registry --check failed:\n${check.stderr || check.stdout}`);
}

if (!process.exitCode) {
  console.log("psr-4b-api-deps-smoke: PASS");
  console.log(`  api product deps: ${declared.length}/${API_PRODUCT_DEP_CEILING} (exact manifests)`);
  console.log(
    `  includes sdk separately: ${Boolean(apiPkg.dependencies?.[SDK] || apiPkg.devDependencies?.[SDK])}`,
  );
  console.log("  generate --check: PASS (api + web writers)");
}
