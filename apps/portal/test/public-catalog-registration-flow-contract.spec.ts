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
  "apps/portal/app/catalog/[tourId]/register/public-catalog-registration-flow.tsx"
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
    assert.match(denaliIntake, /data-registration-target-tabs/);
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

  it("PCMS-REG-LINK-01 register page exposes guest sign-in link with portalReturn", () => {
    const pagePath = join(
      repoRoot,
      "apps/portal/app/catalog/[tourId]/register/page.tsx"
    );
    const page = readFileSync(pagePath, "utf8");
    assert.match(page, /data-portal-register-sign-in-link/);
    assert.match(page, /resolvePortalMemberLoginPath/);
    assert.match(page, /signInToRegister/);
  });

  it("P8-03 OTP orchestration lives in shared catalog-registration-flow-ui", () => {
    const authStepsPath = join(
      repoRoot,
      "packages/catalog-registration-flow-ui/src/catalog-registration-auth-steps.tsx"
    );
    const authSteps = readFileSync(authStepsPath, "utf8");
    assert.match(authSteps, /request-otp/);
    assert.match(authSteps, /verify-otp/);
    assert.match(authSteps, /completeMemberLoginEgress/);
    assert.match(authSteps, /isMemberLoginEgressFromLocation/);
    assert.doesNotMatch(
      authSteps,
      /completeMemberLoginEgressIfPresent\(\)[\s\S]*hydrateCatalogRegistrationIntakeAfterSession/
    );
    assert.match(
      authSteps,
      /if \(isMemberLoginEgressFromLocation\(\)\) \{[\s\S]*completeMemberLoginEgress\(\);[\s\S]*return;[\s\S]*\}[\s\S]*await hydrateCatalogRegistrationIntakeAfterSession/
    );
    assert.doesNotMatch(denaliIntake, /request-otp/);
  });
});
