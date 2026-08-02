#!/usr/bin/env node
/**
 * PSR-5f — background_repair admin capability inventory + reclaim pilot ratchet.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-5f-background-admin-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-5f-background-admin-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-5f-background-admin-inventory") {
  fail("wave must be PSR-5f-background-admin-inventory");
}
if (!inv.policy?.migrate_by_reason_cluster_only) {
  fail("policy.migrate_by_reason_cluster_only must be true");
}
if (!inv.policy?.forbid_bulk_background_migrate_in_inventory_wave) {
  fail("policy.forbid_bulk_background_migrate_in_inventory_wave must be true");
}
if ((inv.sites || []).length !== inv.ratchet.background_admin_files_total) {
  fail(
    `sites drift: yaml=${(inv.sites || []).length} ratchet=${inv.ratchet.background_admin_files_total}`,
  );
}
if ((inv.reason_codes || []).length !== inv.ratchet.reason_code_count) {
  fail("reason_code_count drift");
}

const clientRel = inv.client_module;
const client = readFileSync(join(root, clientRel), "utf8");
if (!client.includes("getBackgroundAdminClient")) {
  fail("client module must export getBackgroundAdminClient");
}
if (!/\bgetPrismaAdmin\s*\(/.test(client)) {
  fail("client module must call getPrismaAdmin(");
}
if (!client.includes("background_admin_access_total")) {
  fail("client must record background_admin_access_total");
}
for (const code of inv.reason_codes || []) {
  if (!client.includes(code)) fail(`client missing reason const ${code}`);
}

const migrated = new Set();
for (const cluster of inv.migrated_clusters || []) {
  for (const rel of cluster.files || []) migrated.add(rel);
}
if (migrated.size !== inv.ratchet.migrated_file_count) {
  fail(
    `migrated_file_count drift: live=${migrated.size} inv=${inv.ratchet.migrated_file_count}`,
  );
}

for (const rel of migrated) {
  const text = readFileSync(join(root, rel), "utf8");
  if (/\bgetPrismaAdmin\s*\(/.test(text)) {
    fail(`migrated file still calls getPrismaAdmin(: ${rel}`);
  }
  if (!text.includes("getBackgroundAdminClient") && !text.includes("background-admin-client")) {
    fail(`migrated file must use getBackgroundAdminClient: ${rel}`);
  }
}

let remainingDirect = 0;
for (const site of inv.sites || []) {
  if (migrated.has(site.path)) continue;
  const text = readFileSync(join(root, site.path), "utf8");
  if (/\bgetPrismaAdmin\s*\(/.test(text)) remainingDirect += 1;
  else fail(`non-migrated site lost getPrismaAdmin without cluster wave: ${site.path}`);
}
if (remainingDirect !== inv.ratchet.remaining_direct) {
  fail(
    `remaining_direct drift: live=${remainingDirect} inv=${inv.ratchet.remaining_direct}`,
  );
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-5f-background-admin-smoke: OK — sites=${(inv.sites || []).length} migrated=${migrated.size} remaining_direct=${remainingDirect}`,
);
