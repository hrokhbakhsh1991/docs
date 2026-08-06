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
});
