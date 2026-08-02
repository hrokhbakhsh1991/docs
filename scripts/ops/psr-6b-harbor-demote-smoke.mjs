#!/usr/bin/env node
/**
 * PSR-6b — Harbor demote ratchet (option A; no persist).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-6b-harbor-demote-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-6b-harbor-demote-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-6b-harbor-demote") fail("wave mismatch");
if (inv.decision !== "option_a_demote") fail("decision must be option_a_demote");
if (inv.architect_option !== "A") fail("architect_option must be A");
if (!inv.policy?.forbid_persist_wiring_in_this_wave) {
  fail("forbid_persist_wiring required");
}
if (inv.ratchet.demote_executed !== true) fail("demote_executed must be true");
if (inv.ratchet.persist_wired !== false) fail("persist_wired must be false");
if (inv.ratchet.production_tier !== "stub") fail("ratchet.production_tier must be stub");
if (inv.ratchet.proof_matrix_has_harbor !== false) {
  fail("proof_matrix_has_harbor must be false");
}

const manifest = JSON.parse(
  readFileSync(
    join(root, "packages/workspaces/harbor/workspace.manifest.json"),
    "utf8",
  ),
);
if (manifest?.guestConformance?.productionTier !== "stub") {
  fail(
    `manifest tier must be stub, got ${manifest?.guestConformance?.productionTier}`,
  );
}

const matrix = readFileSync(
  join(root, "docs/dev/workspace-certification-proof-matrix.yaml"),
  "utf8",
);
if (/^  harbor:/m.test(matrix)) {
  fail("proof matrix must not declare live plugins.harbor rows");
}
if (!matrix.includes("docs/workspaces/harbor/certification.md")) {
  fail("proof matrix must retain historical runbook pointer comment");
}

const generatedPath = join(
  root,
  "packages/workspace-sdk/src/catalog/workspace-production-certification.generated.ts",
);
if (!existsSync(generatedPath)) fail("missing generated certification map");
const generated = readFileSync(generatedPath, "utf8");
const harborMatch = generated.match(/"harbor":\s*"(stub|certified)"/);
if (!harborMatch) fail("generated map missing harbor entry");
if (harborMatch[1] !== "stub") {
  fail(`generated harbor tier must be stub, got ${harborMatch[1]}`);
}
if (harborMatch[1] !== inv.ratchet.generated_harbor_tier) {
  fail("generated_harbor_tier ratchet drift");
}

const store = readFileSync(
  join(
    root,
    "packages/workspaces/harbor/src/catalog/harbor-smoke-catalog.store.ts",
  ),
  "utf8",
);
if (!store.includes("private readonly cards = new Map")) {
  fail("persist must not be wired yet — memory Map required");
}

const http = readFileSync(
  join(root, "packages/workspaces/harbor/src/http/harbor-catalog-http.ts"),
  "utf8",
);
if (!http.includes("HARBOR_SMOKE_E2E_SEED")) {
  fail("smoke seed gate must remain until PSR-6c");
}

const runbook = readFileSync(
  join(root, "docs/workspaces/harbor/certification.md"),
  "utf8",
);
if (!/Current tier[\s\S]*`stub`/i.test(runbook) && !runbook.includes("**`stub`**")) {
  fail("certification runbook must state current tier stub");
}
if (!runbook.includes("not** current production authority") && !runbook.includes("not current production authority")) {
  fail("runbook must disclaim production authority");
}

const listSpec = readFileSync(
  join(root, "apps/api/test/list-platform-workspaces.spec.ts"),
  "utf8",
);
if (listSpec.includes('harbor.productionTier, "certified"')) {
  fail("list-platform-workspaces must not expect harbor certified");
}
if (!listSpec.includes('"harbor"') || !listSpec.includes('productionTier, "stub"')) {
  fail("list-platform-workspaces must expect harbor among stubs");
}

const provSpec = readFileSync(
  join(root, "apps/api/test/provision-tenant-production.spec.ts"),
  "utf8",
);
if (provSpec.includes("allows harbor (certified")) {
  fail("provision spec must not allow harbor as certified");
}
if (!provSpec.includes("rejects harbor stub")) {
  fail("provision spec must reject harbor stub");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  "psr-6b-harbor-demote-smoke: OK — tier=stub proof_matrix_harbor=absent persist=false option=A",
);
