/**
 * Operator welcome — pure gate/content logic (no browser mocks)
 * Wiring + BFF cookies: operator-login-ui-contract · auth-bff-login-codes · auth-login-flow
 * E2E: operator-smoke SMK-P9-WELCOME
 * Authority: docs/phase-9/appendices/OPERATOR-WELCOME-UX.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveOperatorWelcomeContent,
  shouldShowOperatorWelcome,
} from "../src/admin/onboarding/resolve-operator-welcome";
import { OPERATOR_WIZARD_PATH } from "../src/admin/require-operator-session";

const DENALI_PLUGIN_ID = "denali";

describe("operator-welcome.spec.ts", () => {
  it("CP-WELCOME-03 gate active for denali owner only", () => {
    assert.equal(shouldShowOperatorWelcome(DENALI_PLUGIN_ID, "owner"), true);
    assert.equal(shouldShowOperatorWelcome(DENALI_PLUGIN_ID, "admin"), false);
    assert.equal(shouldShowOperatorWelcome("urban", "owner"), false);
  });

  it("CP-WELCOME-04 denali welcome content and wizard CTA path", () => {
    const content = resolveOperatorWelcomeContent(DENALI_PLUGIN_ID);
    assert.equal(content.active, true);
    assert.equal(content.bullets.length, 3);
    assert.equal(OPERATOR_WIZARD_PATH, "/tours/new");
  });
});
