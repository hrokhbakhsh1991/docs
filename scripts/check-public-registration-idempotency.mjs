#!/usr/bin/env node
/**
 * Ensures anonymous public registration mutations cannot bypass mandatory Idempotency-Key:
 * - No optional `if (!idempotencyKey)` short-circuit on public placement handlers.
 * - Controller must reference the shared assertion helper (single source of truth).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CONTROLLER = path.join(
  REPO_ROOT,
  "apps/api/src/modules/registrations/registrations.controller.ts"
);

function fail(message) {
  console.error(`[check-public-registration-idempotency] ${message}`);
  process.exitCode = 1;
}

const text = fs.readFileSync(CONTROLLER, "utf8");

if (!text.includes("assertPublicRegistrationIdempotencyKey")) {
  fail(
    `${path.relative(REPO_ROOT, CONTROLLER)} must import and call assertPublicRegistrationIdempotencyKey for public routes.`
  );
}

const publicBlockStart = text.indexOf('@Get("tours/:tourId/registration-idempotency-key")');
const publicBlockEnd = text.indexOf('@Post("registrations")');
if (publicBlockStart === -1 || publicBlockEnd === -1 || publicBlockEnd <= publicBlockStart) {
  fail("Could not locate public registration block boundaries.");
}
const publicSlice = text.slice(publicBlockStart, publicBlockEnd);
if (publicSlice.includes("if (!idempotencyKey)")) {
  fail(
    "Public registration routes (mint + POST register/waitlist) must not use optional idempotency bypass (found \"if (!idempotencyKey)\")."
  );
}

const registerIdx = text.indexOf("async publicRegister");
const waitlistIdx = text.indexOf("async publicWaitlist");
if (registerIdx === -1 || waitlistIdx === -1) {
  fail("Could not locate publicRegister / publicWaitlist handlers.");
}
const sliceRegister = text.slice(registerIdx, waitlistIdx);
if (!sliceRegister.includes("assertPublicRegistrationIdempotencyKey")) {
  fail("publicRegister must call assertPublicRegistrationIdempotencyKey.");
}

const sliceWaitlist = text.slice(waitlistIdx, waitlistIdx + 800);
if (!sliceWaitlist.includes("assertPublicRegistrationIdempotencyKey")) {
  fail("publicWaitlist must call assertPublicRegistrationIdempotencyKey.");
}

if (process.exitCode === 1) {
  process.exit(1);
}
console.log("[check-public-registration-idempotency] OK");
