#!/usr/bin/env node
/**
 * PSR-6c4 — Harbor durable registration ratchet.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const invPath = join(
  root,
  "docs/audits/snapshots/2026-07-31/psr-6c4-harbor-durable-registration-inventory.yaml",
);

function fail(msg) {
  console.error(`psr-6c4-harbor-durable-registration-smoke: FAIL — ${msg}`);
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
if (inv.wave !== "PSR-6c4-harbor-durable-registration") fail("wave mismatch");
if (inv.decision !== "booking_public_port_thin_register") fail("decision mismatch");
if (!inv.policy?.keep_smoke_seed_path) fail("keep_smoke_seed_path required");
if (inv.ratchet.durable_registration !== true) fail("durable_registration must be true");
if (inv.ratchet.tier_stub !== true) fail("tier_stub must be true");

const create = readFileSync(
  join(root, "packages/workspaces/harbor/src/registration/create-harbor-registration.ts"),
  "utf8",
);
if (!create.includes("createPendingBooking")) fail("booking create missing");
if (/createDenaliRegistration|denali-registration/.test(create)) {
  fail("denali registration clone");
}

const http = readFileSync(
  join(root, "packages/workspaces/harbor/src/http/harbor-catalog-http.ts"),
  "utf8",
);
if (!http.includes("postDurableHarborRegistration")) {
  fail("durable register HTTP missing");
}
if (!http.includes("smokeHandlers.handleRegister")) {
  fail("seed register path must remain");
}

const configure = readFileSync(
  join(root, "apps/api/src/http/configure-product-http-hosts.ts"),
  "utf8",
);
if (!configure.includes("resolvePublicBookingPort")) {
  fail("API Harbor booking port missing");
}
if (!configure.includes("readHarborRegistrationRequestBody")) {
  fail("API Harbor registration body reader missing");
}

const registrar = readFileSync(
  join(root, "apps/api/src/http/workspace-route-registrar.ts"),
  "utf8",
);
if (!registrar.includes('handlePostHarborRegistration: "product"')) {
  fail("Harbor register dispatch must be product");
}

const errMap = readFileSync(
  join(root, "apps/api/src/middleware/workspace-http-error-map.generated.ts"),
  "utf8",
);
if (!errMap.includes("HARBOR_REGISTRATION_DUPLICATE")) {
  fail("error map missing Harbor duplicate — regenerate registry");
}

const manifest = JSON.parse(
  readFileSync(
    join(root, "packages/workspaces/harbor/workspace.manifest.json"),
    "utf8",
  ),
);
if (manifest.guestConformance?.productionTier !== "stub") {
  fail("tier must stay stub");
}

const pkg = JSON.parse(
  readFileSync(join(root, "packages/workspaces/harbor/package.json"), "utf8"),
);
if (!pkg.dependencies?.["@app-tour/booking-http-contracts"]) {
  fail("harbor must depend on booking-http-contracts");
}

if (inv.ratchet.next_slice !== "PSR-6c5-harbor-durable-proofs-recert") {
  fail("next_slice drift");
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  "psr-6c4-harbor-durable-registration-smoke: OK — durable_register=true seed_intact=true tier=stub next=PSR-6c5",
);
