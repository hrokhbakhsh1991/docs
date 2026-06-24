/**
 * P6-1 — Portal catalog registration flow contract
 * @see docs/phase-19/platform-portal-otp-flow.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const flowPath = join(
  repoRoot,
  "apps/portal/app/catalog/[tourId]/register/public-catalog-registration-flow.tsx"
);
const otpServicePath = join(repoRoot, "apps/api/src/identity/otp.service.ts");
const publicAuthPath = join(repoRoot, "apps/api/src/identity/public-auth.routes.ts");
const faMessagesPath = join(repoRoot, "apps/portal/messages/fa/catalogRegistration.json");
const otpFlowDocPath = join(repoRoot, "docs/phase-19/platform-portal-otp-flow.mdoc");

describe("public-catalog-registration-flow-contract — P6-1 OTP", () => {
  const flow = readFileSync(flowPath, "utf8");
  const otpService = readFileSync(otpServicePath, "utf8");
  const publicAuth = readFileSync(publicAuthPath, "utf8");
  const faMessages = readFileSync(faMessagesPath, "utf8");
  const otpDoc = readFileSync(otpFlowDocPath, "utf8");

  it("OTP-01 flow defines phone → otp → profile → intake → done steps", () => {
    assert.match(flow, /PublicRegistrationStep/);
    assert.match(flow, /useState<PublicRegistrationStep>\("phone"\)/);
    assert.match(flow, /data-public-registration-phone/);
    assert.match(flow, /data-public-registration-otp/);
    assert.match(flow, /data-public-registration-profile/);
    assert.match(flow, /data-public-registration-intake/);
    assert.match(flow, /data-public-registration-success/);
  });

  it("OTP-02 dev OTP is 1234 in UI and API", () => {
    assert.match(flow, /PUBLIC_REGISTRATION_DEV_OTP/);
    assert.match(otpService, /DEV_STATIC_OTP = "1234"/);
    assert.match(otpDoc, /1234/);
  });

  it("OTP-03 new user routes to profile when requires_registration", () => {
    assert.match(flow, /requires_registration === true/);
    assert.match(flow, /setStep\("profile"\)/);
    assert.match(publicAuth, /requiresRegistration: true, onboardingToken/);
  });

  it("OTP-04 existing user skips profile and goes to intake", () => {
    assert.match(flow, /await hydrateIntakeAfterSession\(\)/);
    assert.match(publicAuth, /sessionToken/);
    assert.match(publicAuth, /membership\.status === "ACTIVE"/);
  });

  it("OTP-05 profile requires display name", () => {
    assert.match(flow, /DISPLAY_NAME_REQUIRED/);
    assert.match(flow, /const name = displayName\.trim\(\)/);
    assert.match(flow, /if \(name\.length === 0\)/);
    assert.match(faMessages, /نام اجباری/);
  });

  it("OTP-06 profile email is optional", () => {
    assert.match(flow, /buildPublicRegistrationProfilePayload/);
    assert.match(faMessages, /ایمیل \(اختیاری\)/);
  });

  it("OTP-07 phone preflight hints existing vs new", () => {
    assert.match(flow, /phoneHint === "existing"/);
    assert.match(flow, /phoneHint === "new"/);
    assert.match(faMessages, /کاربر جدید/);
  });

  it("OTP-08 intake shows tour policies when catalog provides policiesText", () => {
    assert.match(flow, /data-tour-policies-text/);
    assert.match(flow, /tourPoliciesText/);
    assert.match(faMessages, /قوانین و شرایط/);
  });
});
