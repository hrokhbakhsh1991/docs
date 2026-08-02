#!/usr/bin/env node
/**
 * PSR-5g — identity admin client owns FORCE-RLS admin I/O; repository must not call getPrismaAdmin.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-5g-identity-admin-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-5g-identity-admin-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-5g-identity-admin-client") {
  fail("wave must be PSR-5g-identity-admin-client");
}
if (inv.decision !== "named_client_behavior_preserving") {
  fail("decision must be named_client_behavior_preserving");
}
if (!inv.policy?.forbid_direct_getPrismaAdmin_in_prisma_identity_repository) {
  fail("policy.forbid_direct_getPrismaAdmin_in_prisma_identity_repository must be true");
}
if (!inv.policy?.closes_alw_id_force_rls) {
  fail("policy.closes_alw_id_force_rls must be true");
}

const client = readFileSync(join(root, inv.client_module), "utf8");
if (!client.includes("getIdentityAdminClient")) {
  fail("client must export getIdentityAdminClient");
}
if (!/\bgetPrismaAdmin\s*\(/.test(client)) {
  fail("client must call getPrismaAdmin(");
}
if (!client.includes("identity_admin_access_total")) {
  fail("client must record identity_admin_access_total");
}
for (const code of inv.reason_codes || []) {
  if (!client.includes(code)) fail(`client missing reason ${code}`);
}
if ((inv.reason_codes || []).length !== inv.ratchet.reason_code_count) {
  fail("reason_code_count drift");
}
if ((inv.sites || []).length !== inv.ratchet.site_count) {
  fail("site_count drift");
}

const consumer = readFileSync(join(root, inv.consumer), "utf8");
if (/\bgetPrismaAdmin\s*\(/.test(consumer)) {
  fail(`consumer still calls getPrismaAdmin(: ${inv.consumer}`);
}
if (!consumer.includes("getIdentityAdminClient") && !consumer.includes("identity-admin-client")) {
  fail("consumer must use getIdentityAdminClient");
}
for (const code of inv.reason_codes || []) {
  if (!consumer.includes(code)) fail(`consumer missing reason usage ${code}`);
}

if (inv.ratchet.consumer_direct_getPrismaAdmin !== 0) {
  fail("ratchet.consumer_direct_getPrismaAdmin must be 0");
}
if (inv.ratchet.closed_alw_id_force_rls !== true) {
  fail("ratchet.closed_alw_id_force_rls must be true");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-5g-identity-admin-smoke: OK — reasons=${inv.ratchet.reason_code_count} sites=${inv.ratchet.site_count} consumer_direct=0`,
);
