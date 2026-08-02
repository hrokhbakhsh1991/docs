#!/usr/bin/env node
/**
 * PSR-6c1 — SDK async durable smoke port ratchet (Harbor/API unwired).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-6c1-sdk-async-durable-port-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-6c1-sdk-async-durable-port-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-6c1-sdk-async-durable-smoke-port") fail("wave mismatch");
if (inv.decision !== "sdk_port_async_plus_durable_gate") fail("decision mismatch");
if (!inv.policy?.forbid_harbor_http_wire_in_this_wave) {
  fail("forbid_harbor_http_wire required");
}
if (inv.ratchet.harbor_durable_enabled !== false) {
  fail("harbor_durable_enabled must be false");
}
if (inv.ratchet.wire_harbor_executed !== false) {
  fail("wire_harbor_executed must be false");
}

const sdk = readFileSync(
  join(
    root,
    "packages/workspace-sdk/src/http/create-workspace-guest-smoke-http-handlers.ts",
  ),
  "utf8",
);
if (!sdk.includes("WorkspaceGuestSmokeMaybeAsync")) {
  fail("MaybeAsync type missing");
}
if (!sdk.includes("isDurableEnabled")) fail("isDurableEnabled missing");
if (!sdk.includes("isGuestSmokeSurfaceOpen")) {
  fail("isGuestSmokeSurfaceOpen helper missing");
}
if (!sdk.includes("await Promise.resolve(port.listPublished())")) {
  fail("async listPublished await missing");
}

const harborHttp = readFileSync(
  join(root, "packages/workspaces/harbor/src/http/harbor-catalog-http.ts"),
  "utf8",
);
if (harborHttp.includes("isDurableEnabled")) {
  fail("Harbor must not enable durable mode in 6c1");
}

const configure = readFileSync(
  join(root, "apps/api/src/http/configure-product-http-hosts.ts"),
  "utf8",
);
if (/configureHarbor/i.test(configure)) {
  fail("API Harbor configure must not exist in 6c1");
}

const spec = readFileSync(
  join(root, "packages/workspace-sdk/test/http-plib-dg1.spec.ts"),
  "utf8",
);
if (!spec.includes("PSR-6c1 durable mode")) {
  fail("missing PSR-6c1 durable mode spec");
}

if (inv.ratchet.next_slice !== "PSR-6c3-api-configure-harbor-host") {
  fail("next_slice drift");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  "psr-6c1-sdk-async-durable-port-smoke: OK — async+durable_gate=true harbor_wire=false next=PSR-6c3",
);
