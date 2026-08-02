#!/usr/bin/env node
/**
 * PSR-5b — formal tenant-adjacent getPrismaAdmin allowlist ratchet.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(root, "docs/audits/snapshots/2026-07-31/psr-5b-admin-allowlist.yaml");

function fail(msg) {
  console.error(`psr-5b-admin-allowlist-smoke: FAIL — ${msg}`);
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

function classify(rel) {
  if (
    rel.startsWith("identity/prisma-identity") ||
    rel.includes("resolve-finance-workspace-type")
  ) {
    return "tenant_path_allowlist_candidate";
  }
  // Delivery claim is background_repair (inventory), not tenant HTTP review.
  if (rel.startsWith("integrations/infrastructure/prisma-integration-delivery")) {
    return null;
  }
  if (
    rel.startsWith("integrations/infrastructure/") ||
    rel.startsWith("bookings/") ||
    rel.startsWith("tours/") ||
    (rel.startsWith("routes/") && !rel.startsWith("routes/platform"))
  ) {
    return "tenant_path_review";
  }
  return null;
}

function walkTs(dir, out = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === "dist") continue;
      walkTs(abs, out);
      continue;
    }
    if (!name.name.endsWith(".ts") || name.name.endsWith(".spec.ts")) continue;
    out.push(abs);
  }
  return out;
}

const inv = loadYaml(invPath);
if (inv.wave !== "PSR-5b-admin-allowlist-doc") {
  fail("wave must be PSR-5b-admin-allowlist-doc");
}
if (inv.decision !== "document_allowlist_only") {
  fail("decision must be document_allowlist_only");
}
if (!inv.policy?.forbid_new_tenant_path_admin_without_pr) {
  fail("policy.forbid_new_tenant_path_admin_without_pr must be true");
}

const entries = inv.entries || [];
if (entries.length !== inv.ratchet.allowlist_entry_count) {
  fail(
    `entry count drift: yaml=${entries.length} ratchet=${inv.ratchet.allowlist_entry_count}`,
  );
}
const ids = new Set(entries.map((e) => e.id));
for (const id of inv.ratchet.required_ids || []) {
  if (!ids.has(id)) fail(`missing required allowlist id: ${id}`);
}

const allowPaths = new Set();
for (const e of entries) {
  if (!e.owner) fail(`${e.id} missing owner`);
  if (!e.reason) fail(`${e.id} missing reason`);
  if (!e.expiry || !/^\d{4}-\d{2}-\d{2}$/.test(String(e.expiry))) {
    fail(`${e.id} missing expiry YYYY-MM-DD`);
  }
  const abs = join(root, e.path);
  let text;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    fail(`${e.id} path missing: ${e.path}`);
    continue;
  }
  if (!/\bgetPrismaAdmin\s*\(/.test(text)) {
    fail(`${e.id} no longer calls getPrismaAdmin( — update inventory if intentional`);
  }
  for (const marker of e.evidence_comment_markers || []) {
    if (!text.includes(marker)) {
      fail(`${e.id} missing evidence marker ${JSON.stringify(marker)}`);
    }
  }
  allowPaths.add(e.path);
}

const apiSrc = join(root, "apps/api/src");
for (const abs of walkTs(apiSrc)) {
  const text = readFileSync(abs, "utf8");
  if (!text.includes("getPrismaAdmin")) continue;
  const rel = relative(apiSrc, abs).split("\\").join("/");
  const cls = classify(rel);
  if (cls === "tenant_path_review") {
    fail(`new tenant_path_review admin site not allowlisted: apps/api/src/${rel}`);
  }
  if (cls === "tenant_path_allowlist_candidate") {
    const full = `apps/api/src/${rel}`;
    if (!allowPaths.has(full)) {
      fail(`allowlist_candidate not in PSR-5b YAML: ${full}`);
    }
  }
}

// Deferred registry paths closed by PSR-5c — must NOT call getPrismaAdmin directly
for (const d of inv.deferred_to_named_port || []) {
  const text = readFileSync(join(root, d.path), "utf8");
  if (d.status === "closed" || d.closed_by === "PSR-5c-tenant-registry-port") {
    if (/\bgetPrismaAdmin\s*\(/.test(text)) {
      fail(`closed deferred path still has getPrismaAdmin(: ${d.path}`);
    }
    if (!text.includes("tenant-registry-admin.port")) {
      fail(`closed deferred path must use tenant-registry-admin.port: ${d.path}`);
    }
    continue;
  }
  if (!/\bgetPrismaAdmin\s*\(/.test(text)) {
    fail(`open deferred registry path lost getPrismaAdmin without PSR-5c: ${d.path}`);
  }
}
if (inv.ratchet.deferred_registry_direct_admin_count !== 0) {
  fail("ratchet.deferred_registry_direct_admin_count must be 0 after PSR-5c");
}

if (inv.ratchet.closed_finance_allowlist !== true) {
  fail("ratchet.closed_finance_allowlist must be true after PSR-5d");
}
if (inv.ratchet.closed_identity_allowlist !== true) {
  fail("ratchet.closed_identity_allowlist must be true after PSR-5g");
}

// Closed identity path must not call getPrismaAdmin; must use identity-admin-client
{
  const idRepo = "apps/api/src/identity/prisma-identity.repository.ts";
  const text = readFileSync(join(root, idRepo), "utf8");
  if (/\bgetPrismaAdmin\s*\(/.test(text)) {
    fail(`closed ALW-ID path still has getPrismaAdmin(: ${idRepo}`);
  }
  if (!text.includes("identity-admin-client") && !text.includes("getIdentityAdminClient")) {
    fail(`closed ALW-ID path must use identity-admin-client: ${idRepo}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-5b-admin-allowlist-smoke: OK — entries=${entries.length} ids=[${[...ids].join(",")}] closed_identity=1`,
);
