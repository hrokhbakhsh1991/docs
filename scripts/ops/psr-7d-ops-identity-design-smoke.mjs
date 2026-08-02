#!/usr/bin/env node
/**
 * PSR-7d — Ops identity design ratchet (doc-only; no apps/api edits in this wave).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-7d-ops-identity-design-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-7d-ops-identity-design-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-7d-ops-identity-design") fail("wave mismatch");
if (inv.decision !== "design_only_no_code") fail("decision mismatch");
if (!inv.policy?.forbid_apps_api_edits_in_this_wave) fail("forbid_api_edits required");
if (!inv.policy?.forbid_claiming_r_ops_id_closed) fail("forbid_r_ops_id_closed required");
if (inv.ratchet.api_code_changed !== false) fail("api_code_changed must be false");
if (inv.ratchet.r_ops_id_closed !== false) fail("r_ops_id_closed must be false");
if (inv.ratchet.psr7_gate_closed !== false) fail("psr7_gate_closed must be false");
if (inv.ratchet.shared_bearer_still_present !== true) {
  fail("shared_bearer_still_present must be true until 7d4");
}
if (inv.ratchet.design_complete !== true) fail("design_complete must be true");

for (const rel of inv.static_assets || []) {
  if (!existsSync(join(root, rel))) fail(`missing asset ${rel}`);
}

const design = readFileSync(
  join(root, "docs/audits/snapshots/2026-07-31/psr-7d-ops-identity-design.mdoc"),
  "utf8",
);
for (const needle of [
  "Dual-accept",
  "short-lived",
  "verify-ops-service-jwt",
  "signPlatformOpsSessionToken",
  "PLATFORM_OPS_BEARER_TOKEN",
  "PSR-7d1",
]) {
  if (!design.includes(needle)) fail(`design missing needle: ${needle}`);
}

const bearer = readFileSync(
  join(root, "apps/api/src/platform/read-platform-ops-bearer-token.ts"),
  "utf8",
);
if (!bearer.includes("PLATFORM_OPS_BEARER_TOKEN")) {
  fail("shared bearer reader unexpectedly removed");
}

const assertAuth = readFileSync(
  join(root, "apps/api/src/platform/assert-platform-ops-auth.ts"),
  "utf8",
);
if (!assertAuth.includes("readPlatformOpsBearerToken")) {
  fail("assertPlatformOpsAuth no longer uses shared bearer — update design wave");
}

const slices = inv.rollout_slices || [];
if (slices[0] !== "PSR-7d1-dual-accept-session-jwt") fail("rollout slice 0 drift");
if (inv.ratchet.next_slice !== "PSR-7d1-dual-accept-session-jwt") fail("next_slice drift");

// Ensure this wave did not modify API platform auth files relative to shared bearer contract.
// (Content presence checks above; no git diff requirement.)

if (process.exitCode) process.exit(process.exitCode);
console.log(
  `psr-7d-ops-identity-design-smoke: OK — design=true api_code=false r_ops_id=open next=PSR-7d1`,
);
