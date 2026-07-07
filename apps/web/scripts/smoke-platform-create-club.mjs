#!/usr/bin/env node
/**
 * Platform create-club smoke checklist (structural + manual steps).
 *
 * Run: node apps/web/scripts/smoke-platform-create-club.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const required = [
  "app/(platform)/platform/clubs/new/page.tsx",
  "app/(platform)/platform/clubs/[id]/page.tsx",
  "src/platform/create-club/create-club-wizard-client.tsx",
  "src/platform/create-club/submit-create-club.ts",
  "app/api/platform/tenants/route.ts",
];

for (const relative of required) {
  const full = path.join(webDir, relative);
  assert.ok(existsSync(full), `missing ${relative}`);
}

const submit = readFileSync(
  path.join(webDir, "src/platform/create-club/submit-create-club.ts"),
  "utf8"
);
assert.match(submit, /Idempotency-Key/);
assert.match(submit, /\/tenants/);

const identity = readFileSync(
  path.join(webDir, "src/platform/create-club/step-identity.tsx"),
  "utf8"
);
assert.match(identity, /production blocked/);
assert.match(identity, /workspace-production-certification-badge/);

console.log("smoke-platform-create-club: structural checks passed");
console.log("");
console.log("Manual smoke (dev):");
console.log("1. PLATFORM_OPS_PHONES=… pnpm --filter @apps/web dev");
console.log("2. Open http://admin.localhost:3000/auth/login and sign in");
console.log("3. Visit /platform/clubs/new — complete 4-step wizard");
console.log("4. Confirm redirect to /platform/clubs/{tenantId}");
