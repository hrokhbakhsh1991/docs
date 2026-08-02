#!/usr/bin/env node
/**
 * PSR-5h — dual-store classification ratchet (no InMemory deletion).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-5h-dual-store-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-5h-dual-store-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-5h-dual-store-classification") {
  fail("wave must be PSR-5h-dual-store-classification");
}
if (inv.decision !== "classify_retain_all_as_test_dev_adapters") {
  fail("decision must be classify_retain_all_as_test_dev_adapters");
}
if (!inv.policy?.forbid_inmemory_deletion_in_this_wave) {
  fail("policy.forbid_inmemory_deletion_in_this_wave must be true");
}
if (inv.policy?.scaffold_only_deletion_candidates !== 0) {
  fail("scaffold_only_deletion_candidates must be 0");
}
if ((inv.factories || []).length !== inv.ratchet.factory_count) {
  fail("factory_count drift");
}
if (inv.ratchet.scaffold_only_count !== 0) {
  fail("scaffold_only_count must be 0");
}
if (inv.ratchet.inmemory_deletion_count !== 0) {
  fail("inmemory_deletion_count must be 0");
}
if (inv.ratchet.retained_test_dev_adapter_count !== inv.ratchet.factory_count) {
  fail("retained_test_dev_adapter_count must equal factory_count");
}
if (inv.ratchet.item_6_status !== "complete_explicit_test_dev_adapters") {
  fail("item_6_status must be complete_explicit_test_dev_adapters");
}

const roleMod = readFileSync(join(root, inv.role_module), "utf8");
if (!roleMod.includes(inv.role_const)) {
  fail(`role module missing ${inv.role_const}`);
}

let retained = 0;
for (const f of inv.factories || []) {
  if (f.role !== "retained_explicit_test_dev_adapter") {
    fail(`unexpected role for ${f.path}: ${f.role}`);
  }
  retained += 1;
  const text = readFileSync(join(root, f.path), "utf8");
  if (!text.includes("assertProductionStorageDriver")) {
    fail(`${f.path} missing assertProductionStorageDriver`);
  }
  if (!text.includes("resolveStorageDriver")) {
    fail(`${f.path} missing resolveStorageDriver`);
  }
  if (!/InMemory/.test(text)) {
    fail(`${f.path} must retain InMemory branch`);
  }
  if (!text.includes("DUAL_STORE_ROLE") || !text.includes(inv.role_const)) {
    fail(`${f.path} must export DUAL_STORE_ROLE from dual-store-role`);
  }
  if (f.test_hook && f.test_hook !== "smoke_memory_stores" && !text.includes(f.test_hook)) {
    fail(`${f.path} missing test_hook ${f.test_hook}`);
  }
}

if (retained !== inv.ratchet.retained_test_dev_adapter_count) {
  fail("retained count drift");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-5h-dual-store-smoke: OK — factories=${retained} scaffold_only=0 item_6=complete_explicit_test_dev_adapters`,
);
