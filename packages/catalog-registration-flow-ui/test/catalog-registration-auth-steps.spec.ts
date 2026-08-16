import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("catalog-registration-auth-steps — PCMS-UX polish", () => {
  it("PCMS-UX-06 phone step exposes existing-member hint hook and copy", () => {
    const authSteps = readFileSync(
      join(
        repoRoot,
        "packages/catalog-registration-flow-ui/src/catalog-registration-auth-steps.tsx"
      ),
      "utf8"
    );
    assert.match(authSteps, /data-phone-hint/);
    assert.match(authSteps, /existingMemberTitle/);
    assert.match(authSteps, /refreshPhoneHint/);
    assert.match(authSteps, /readMemberLoginEgress/);
    assert.doesNotMatch(authSteps, /isMemberLoginEgressFromLocation/);
  });

  it("PCMS-UX-ERR-01 clears presentation errors on edit and skips HTML5 validation", () => {
    const authSteps = readFileSync(
      join(
        repoRoot,
        "packages/catalog-registration-flow-ui/src/catalog-registration-auth-steps.tsx"
      ),
      "utf8"
    );
    assert.match(authSteps, /noValidate/);
    assert.match(authSteps, /setError\(null\)/);
    assert.match(authSteps, /classifyPublicRegistrationMobileInput/);
    assert.doesNotMatch(authSteps, /isPublicRegistrationMobileValid/);
    assert.doesNotMatch(authSteps, /code\.length < 4/);
    assert.doesNotMatch(authSteps, /DISPLAY_NAME_REQUIRED/);
    assert.doesNotMatch(authSteps, /\srequired\b/);
    assert.match(authSteps, /type="text"/);
    assert.match(authSteps, /inputMode="email"/);
  });

  it("GL-PHONE-02 change-phone clears the field instead of restoring the US smoke number", () => {
    const authSteps = readFileSync(
      join(
        repoRoot,
        "packages/catalog-registration-flow-ui/src/catalog-registration-auth-steps.tsx"
      ),
      "utf8"
    );
    assert.match(authSteps, /phone: ""/);
    assert.match(authSteps, /guestLoginPhoneFieldValue/);
    assert.match(authSteps, /name="guest-mobile"/);
    assert.match(authSteps, /autoComplete="off"/);
    assert.match(authSteps, /inputMode="tel"/);
    assert.doesNotMatch(authSteps, /initialPublicRegistrationPhone/);
    assert.doesNotMatch(authSteps, /PUBLIC_REGISTRATION_DEV_PHONE/);
    assert.doesNotMatch(authSteps, /\+15550009901/);
    assert.doesNotMatch(authSteps, /autoComplete="tel"/);
  });

  it("GL-OTP-01 autofill sink is unnamed and cells use catalogRegistration i18n", () => {
    const otpInput = readFileSync(
      join(repoRoot, "packages/catalog-registration-flow-ui/src/otp-segment-input.tsx"),
      "utf8"
    );
    const authSteps = readFileSync(
      join(
        repoRoot,
        "packages/catalog-registration-flow-ui/src/catalog-registration-auth-steps.tsx"
      ),
      "utf8"
    );
    assert.match(otpInput, /data-otp-autofill-sink/);
    assert.match(otpInput, /aria-hidden="true"/);
    assert.match(otpInput, /tabIndex=\{-1\}/);
    assert.match(otpInput, /otp\.digitLabel/);
    assert.match(otpInput, /otp\.groupLabel/);
    assert.doesNotMatch(otpInput, /Digit \$\{index/);
    assert.doesNotMatch(otpInput, /className="sr-only"/);
    assert.doesNotMatch(authSteps, /htmlFor="otp"/);
    const faOtp = JSON.parse(
      readFileSync(join(repoRoot, "apps/portal/messages/fa/catalogRegistration.json"), "utf8")
    ) as { readonly otp?: { readonly digitLabel?: string; readonly groupLabel?: string } };
    const enOtp = JSON.parse(
      readFileSync(join(repoRoot, "apps/portal/messages/en/catalogRegistration.json"), "utf8")
    ) as { readonly otp?: { readonly digitLabel?: string; readonly groupLabel?: string } };
    assert.equal(faOtp.otp?.digitLabel, "رقم {index}");
    assert.equal(enOtp.otp?.digitLabel, "Digit {index}");
    assert.equal(faOtp.otp?.groupLabel, "کد یک‌بارمصرف");
    assert.equal(enOtp.otp?.groupLabel, "One-time code");
  });
});
