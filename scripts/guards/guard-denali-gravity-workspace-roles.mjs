#!/usr/bin/env node
/** DG-6 workspace-role ratchet using existing manifest capabilities. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workspacesRoot = process.env.DENALI_GRAVITY_WORKSPACES_ROOT
  ? path.resolve(process.env.DENALI_GRAVITY_WORKSPACES_ROOT)
  : path.join(repoRoot, "packages/workspaces");

function manifest(id) {
  const file = path.join(workspacesRoot, id, "workspace.manifest.json");
  if (!fs.existsSync(file)) throw new Error(`${id}: manifest missing`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const violations = [];
for (const id of ["finance-ws2", "finance-ws3", "finance-ws4", "finance-ws6"]) {
  const value = manifest(id);
  if (value.workspaceFinance?.supported !== false || value.workspaceFinance?.registryOnly !== true) {
    violations.push(`${id}: must remain supported=false + registryOnly=true fixture`);
  }
}

const financeProof = manifest("finance-ws5");
if (
  financeProof.workspaceFinance?.supported !== true ||
  financeProof.workspaceFinance?.registryOnly === true
) {
  violations.push("finance-ws5: must remain a supported capability proof, not registryOnly");
}

const bookingProof = manifest("booking-ws2");
if (bookingProof.workspaceBooking?.supported !== true) {
  violations.push("booking-ws2: must remain a supported booking capability proof");
}

const walletProof = manifest("wallet-ws1");
if (walletProof.workspaceWallet?.supported !== true) {
  violations.push("wallet-ws1: must remain a supported wallet capability proof");
}

for (const [id, value] of [
  ["finance-ws5", financeProof],
  ["booking-ws2", bookingProof],
  ["wallet-ws1", walletProof],
]) {
  if (value.guestConformance?.productionTier === "certified") {
    violations.push(`${id}: capability proof must not become a certified guest product implicitly`);
  }
}

if (violations.length > 0) {
  console.error("guard-denali-gravity-workspace-roles: FAIL");
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}

console.log(
  "guard-denali-gravity-workspace-roles: PASS (4 registry fixtures; finance-ws5 + booking-ws2 + wallet-ws1 capability proofs; 0 implicit guest products)",
);
