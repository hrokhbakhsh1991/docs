/**
 * P8 — Portal catalog registration flow is a thin plugin runtime shell.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const flowPath = join(
  repoRoot,
  "apps/portal/src/catalog/public-catalog-registration-flow.tsx"
);
const denaliIntakeStepPath = join(
  repoRoot,
  "packages/workspaces/denali/src/catalog/registration-flow/denali-registration-flow.steps.tsx"
);

describe("public-catalog-registration-flow-contract — P8 plugin runtime", () => {
  const flow = readFileSync(flowPath, "utf8");
  const denaliIntake = readFileSync(denaliIntakeStepPath, "utf8");

  it("P8-01 portal flow delegates to registration flow plugin registry", () => {
    assert.match(flow, /getWorkspaceRegistrationFlowPlugin/);
    assert.match(flow, /getWorkspaceRegistrationFlowSteps/);
    assert.doesNotMatch(flow, /request-otp/);
    assert.doesNotMatch(flow, /verify-otp/);
    assert.doesNotMatch(flow, /setStep\(/);
  });

  it("P8-02 denali plugin owns intake transport and registrant UI", () => {
    assert.match(denaliIntake, /data-denali-other-guest-list/);
    assert.match(denaliIntake, /data-denali-intake-summary-card/);
    assert.match(denaliIntake, /data-denali-other-guest-toolbar/);
    assert.match(denaliIntake, /data-public-registration-transport/);
    assert.match(denaliIntake, /RenderIntakeForm/);
    assert.match(denaliIntake, /tourRequirements: context\.tourRequirements/);
  });

  it("P8-02b portal flow wires catalog tourRequirements into registration context", () => {
    const pagePath = join(
      repoRoot,
      "apps/portal/app/catalog/[tourId]/register/page.tsx"
    );
    const page = readFileSync(pagePath, "utf8");
    assert.match(page, /tourNationalIdRequired=/);
    assert.match(flow, /tourRequirements:/);
    assert.match(page, /buildRegistrationResumeInitialState/);
  });

  it("PCMS-REG-LINK-01 / PCMS-UX-MODAL-04 register guest opens modal-first auth gate", () => {
    const pagePath = join(
      repoRoot,
      "apps/portal/app/catalog/[tourId]/register/page.tsx"
    );
    const page = readFileSync(pagePath, "utf8");
    const signIn = readFileSync(
      join(repoRoot, "apps/portal/src/auth/portal-register-sign-in-link.tsx"),
      "utf8"
    );
    const gate = readFileSync(
      join(repoRoot, "apps/portal/src/auth/portal-register-guest-auth-gate.tsx"),
      "utf8"
    );
    assert.match(page, /PortalRegisterGuestAuthGate/);
    assert.match(page, /PortalLoginModalOpener/);
    assert.match(page, /data-portal-register-guest-auth/);
    assert.match(gate, /PortalRegisterSignInLink/);
    assert.match(signIn, /data-portal-register-sign-in-link/);
    assert.match(signIn, /openLoginModal/);
    assert.match(signIn, /host: "register"/);
    assert.doesNotMatch(page, /auth === "login"/);
  });

  it("P8-03 OTP orchestration lives in shared catalog-registration-flow-ui", () => {
    const authStepsPath = join(
      repoRoot,
      "packages/catalog-registration-flow-ui/src/catalog-registration-auth-steps.tsx"
    );
    const transportPath = join(
      repoRoot,
      "packages/catalog-registration-flow-ui/src/guest-auth-transport.ts"
    );
    const hostPath = join(
      repoRoot,
      "packages/catalog-registration-flow-ui/src/guest-auth-host.tsx"
    );
    const otpInputPath = join(
      repoRoot,
      "packages/catalog-registration-flow-ui/src/otp-segment-input.tsx"
    );
    const authSteps = readFileSync(authStepsPath, "utf8");
    const transport = readFileSync(transportPath, "utf8");
    const host = readFileSync(hostPath, "utf8");
    const otpInput = readFileSync(otpInputPath, "utf8");
    assert.match(authSteps, /useGuestAuthHost/);
    assert.match(authSteps, /probeSession/);
    assert.match(authSteps, /onAuthenticated/);
    assert.match(authSteps, /OtpSegmentInput/);
    assert.match(authSteps, /readMemberLoginEgress/);
    assert.doesNotMatch(authSteps, /\/api\/public-auth/);
    assert.doesNotMatch(authSteps, /finishMemberLoginEgress/);
    assert.doesNotMatch(authSteps, /completeMemberLoginEgressAfterSession/);
    assert.doesNotMatch(authSteps, /hydrateCatalogRegistrationIntakeAfterSession/);
    assert.doesNotMatch(authSteps, /isMemberLoginEgressFromLocation/);
    assert.match(transport, /createPortalSameOriginGuestAuthTransport/);
    assert.match(transport, /phone-preflight/);
    assert.match(transport, /request-otp/);
    assert.match(transport, /verify-otp/);
    assert.match(transport, /register-complete/);
    assert.match(transport, /credentials: "include"/);
    assert.doesNotMatch(transport, /baseUrl/);
    assert.match(host, /GuestAuthHostProvider/);
    assert.match(host, /onAuthenticated/);
    assert.match(flow, /GuestAuthHostProvider/);
    assert.match(flow, /createPortalSameOriginGuestAuthTransport/);
    assert.match(flow, /onAuthenticated/);
    assert.match(flow, /completeMemberLoginEgress\(/);
    assert.doesNotMatch(flow, /completeMemberLoginEgressAfterSession/);
    assert.match(otpInput, /data-otp-segment-input/);
    assert.match(otpInput, /one-time-code/);
    assert.doesNotMatch(denaliIntake, /request-otp/);
  });
});
