#!/usr/bin/env node
/**
 * PSR-5d — finance resolver uses TenantRegistryAdminPort; ALW-FIN closed.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function fail(msg) {
  console.error(`psr-5d-finance-resolver-port-smoke: FAIL — ${msg}`);
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

const financeRel =
  "apps/api/src/workspace-finance/resolve-finance-workspace-type-for-tenant.ts";
const portRel = "apps/api/src/tenant/tenant-registry-admin.port.ts";
const finance = readFileSync(join(root, financeRel), "utf8");
const port = readFileSync(join(root, portRel), "utf8");

if (/\bgetPrismaAdmin\s*\(/.test(finance)) {
  fail("finance resolver must not call getPrismaAdmin(");
}
if (!finance.includes("findTenantFinanceWorkspaceRow")) {
  fail("finance resolver must call findTenantFinanceWorkspaceRow");
}
if (!finance.includes("REGISTRY_RESOLVE_FINANCE_WORKSPACE")) {
  fail("finance resolver must pass REGISTRY_RESOLVE_FINANCE_WORKSPACE");
}
if (!port.includes("findTenantFinanceWorkspaceRow")) {
  fail("port must define findTenantFinanceWorkspaceRow");
}
if (!port.includes("REGISTRY_RESOLVE_FINANCE_WORKSPACE")) {
  fail("port must define REGISTRY_RESOLVE_FINANCE_WORKSPACE");
}

const allow = loadYaml(
  join(root, "docs/audits/snapshots/2026-07-31/psr-5b-admin-allowlist.yaml"),
);
if (allow.ratchet.allowlist_entry_count !== 1) {
  fail("allowlist_entry_count must be 1 after closing ALW-FIN");
}
if ((allow.ratchet.required_ids || []).includes("ALW-FIN-TENANT-ROW")) {
  fail("ALW-FIN-TENANT-ROW must not remain in required_ids");
}
const closed = (allow.closed_entries || []).find((e) => e.id === "ALW-FIN-TENANT-ROW");
if (!closed || closed.closed_by !== "PSR-5d-finance-resolver-via-registry-port") {
  fail("ALW-FIN-TENANT-ROW must be listed under closed_entries by PSR-5d");
}
if (allow.ratchet.closed_finance_allowlist !== true) {
  fail("ratchet.closed_finance_allowlist must be true");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  "psr-5d-finance-resolver-port-smoke: OK — finance via port; ALW-FIN closed",
);
