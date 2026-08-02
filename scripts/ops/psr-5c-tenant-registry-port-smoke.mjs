#!/usr/bin/env node
/**
 * PSR-5c — TenantRegistryAdminPort owns registry admin I/O; consumers must not call getPrismaAdmin.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-5c-tenant-registry-port-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-5c-tenant-registry-port-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-5c-tenant-registry-port") {
  fail("wave must be PSR-5c-tenant-registry-port");
}
if (inv.decision !== "named_port_behavior_preserving") {
  fail("decision must be named_port_behavior_preserving");
}
if (!inv.policy?.forbid_direct_getPrismaAdmin_in_resolve_update) {
  fail("policy.forbid_direct_getPrismaAdmin_in_resolve_update must be true");
}

const portRel = inv.port.path;
const portText = readFileSync(join(root, portRel), "utf8");
if (!/\bgetPrismaAdmin\s*\(/.test(portText)) {
  fail("port must call getPrismaAdmin(");
}
for (const code of inv.port.reason_codes || []) {
  if (!portText.includes(code)) fail(`port missing reason code ${code}`);
}
if ((inv.port.reason_codes || []).length !== inv.ratchet.reason_code_count) {
  fail("reason_code_count drift");
}

const reasons = [
  "REGISTRY_RESOLVE_BY_ID",
  "REGISTRY_RESOLVE_BY_SUBDOMAIN",
  "REGISTRY_RESOLVE_THEME",
  "REGISTRY_RESOLVE_FINANCE_WORKSPACE",
  "REGISTRY_UPDATE",
];
for (const code of reasons) {
  if (!portText.includes(code)) fail(`missing ${code}`);
}

let consumerDirect = 0;
for (const rel of inv.consumers || []) {
  const text = readFileSync(join(root, rel), "utf8");
  if (/\bgetPrismaAdmin\s*\(/.test(text)) {
    consumerDirect += 1;
    fail(`consumer still calls getPrismaAdmin(: ${rel}`);
  }
  if (!text.includes("tenant-registry-admin.port")) {
    fail(`consumer must import tenant-registry-admin.port: ${rel}`);
  }
}
if (consumerDirect !== inv.ratchet.consumer_direct_getPrismaAdmin_count) {
  fail(
    `consumer_direct_getPrismaAdmin_count drift: live=${consumerDirect} inv=${inv.ratchet.consumer_direct_getPrismaAdmin_count}`,
  );
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-5c-tenant-registry-port-smoke: OK — port=${portRel} consumers=${(inv.consumers || []).length} direct_admin=0`,
);
