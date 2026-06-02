#!/usr/bin/env node
/**
 * Ensures anonymous public registration mutations cannot bypass mandatory Idempotency-Key:
 * - No optional `if (!idempotencyKey)` short-circuit on public placement handlers.
 * - Controller must reference the shared assertion helper (single source of truth).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportAndExit, reportFatal } from "./guardrail-report.mjs";

const SCRIPT = "check-public-registration-idempotency";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CONTROLLER = path.join(
  REPO_ROOT,
  "apps/api/src/modules/registrations/registrations.controller.ts",
);

function main() {
  const violations = [];
  const text = fs.readFileSync(CONTROLLER, "utf8");

  if (!text.includes("assertPublicRegistrationIdempotencyKey")) {
    violations.push(
      `${path.relative(REPO_ROOT, CONTROLLER)} must import and call assertPublicRegistrationIdempotencyKey for public routes.`,
    );
  }

  const publicBlockStart = text.indexOf('@Get("tours/:tourId/registration-idempotency-key")');
  const publicBlockEnd = text.indexOf('@Post("registrations")');
  if (publicBlockStart === -1 || publicBlockEnd === -1 || publicBlockEnd <= publicBlockStart) {
    violations.push("Could not locate public registration block boundaries.");
  } else {
    const publicSlice = text.slice(publicBlockStart, publicBlockEnd);
    if (publicSlice.includes("if (!idempotencyKey)")) {
      violations.push(
        'Public registration routes (mint + POST register/waitlist) must not use optional idempotency bypass (found "if (!idempotencyKey)").',
      );
    }
  }

  const registerIdx = text.indexOf("async publicRegister");
  const waitlistIdx = text.indexOf("async publicWaitlist");
  if (registerIdx === -1 || waitlistIdx === -1) {
    violations.push("Could not locate publicRegister / publicWaitlist handlers.");
  } else {
    const sliceRegister = text.slice(registerIdx, waitlistIdx);
    if (!sliceRegister.includes("assertPublicRegistrationIdempotencyKey")) {
      violations.push("publicRegister must call assertPublicRegistrationIdempotencyKey.");
    }

    const sliceWaitlist = text.slice(waitlistIdx, waitlistIdx + 800);
    if (!sliceWaitlist.includes("assertPublicRegistrationIdempotencyKey")) {
      violations.push("publicWaitlist must call assertPublicRegistrationIdempotencyKey.");
    }
  }

  reportAndExit(SCRIPT, violations);
}

try {
  main();
} catch (err) {
  reportFatal(SCRIPT, err);
}
