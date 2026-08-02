#!/usr/bin/env node
/**
 * PSR-6c3 — Harbor API configure + durable list/detail ratchet.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-6c3-api-configure-harbor-host-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-6c3-api-configure-harbor-host-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-6c3-api-configure-harbor-host") fail("wave mismatch");
if (inv.decision !== "configure_host_plus_durable_list_detail") {
  fail("decision mismatch");
}
if (!inv.policy?.durable_registration_deferred) {
  fail("durable_registration_deferred required");
}
if (inv.ratchet.durable_registration !== true) {
  fail("durable_registration must be true after PSR-6c4");
}
if (inv.ratchet.api_configure_harbor !== true) {
  fail("api_configure_harbor must be true");
}

const manifest = JSON.parse(
  readFileSync(
    join(root, "packages/workspaces/harbor/workspace.manifest.json"),
    "utf8",
  ),
);
if (manifest?.productHttpHost?.configureExport !== "configureHarborHttpHost") {
  fail("manifest productHttpHost.configureExport missing");
}
if (manifest?.guestConformance?.productionTier !== "stub") {
  fail("Harbor must remain stub");
}

const generated = readFileSync(
  join(root, "apps/api/src/http/workspace-product-http-host-bindings.generated.ts"),
  "utf8",
);
if (!generated.includes("configureHarborHttpHost")) {
  fail("generated bindings missing configureHarborHttpHost — regenerate registry");
}

const configure = readFileSync(
  join(root, "apps/api/src/http/configure-product-http-hosts.ts"),
  "utf8",
);
if (!configure.includes("configureHarborHttpHost")) {
  fail("configure-product-http-hosts missing Harbor configure");
}
if (/from "@app-tour\/workspace-harbor/.test(configure)) {
  fail("configure must not import harbor package directly");
}

const http = readFileSync(
  join(root, "packages/workspaces/harbor/src/http/harbor-catalog-http.ts"),
  "utf8",
);
if (!http.includes("listDurableHarborCatalog")) {
  fail("durable list path missing");
}
if (!http.includes("toHarborCatalogCard")) {
  fail("durable path must use toHarborCatalogCard");
}
if (/listDenaliCatalog|@app-tour\/workspace-denali/.test(http)) {
  fail("denali clone in harbor http");
}
if (!http.includes("smokeHandlers.handleRegister")) {
  fail("register must keep smoke/seed path");
}
if (!http.includes("postDurableHarborRegistration")) {
  fail("durable register expected after PSR-6c4");
}

const registrar = readFileSync(
  join(root, "apps/api/src/http/workspace-route-registrar.ts"),
  "utf8",
);
if (!registrar.includes('handleGetHarborCatalog: "product"')) {
  fail("Harbor catalog dispatch must be product");
}
if (!registrar.includes('handlePostHarborRegistration: "product"')) {
  fail("Harbor registration dispatch must be product after PSR-6c4");
}

if (inv.ratchet.next_slice !== "PSR-6c5-harbor-durable-proofs-recert") {
  fail("next_slice drift");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  "psr-6c3-api-configure-harbor-host-smoke: OK — configure=true durable_list=true durable_register=true next=PSR-6c5",
);
