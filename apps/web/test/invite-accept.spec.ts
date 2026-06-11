/**
 * Phase 9.4 — invite accept chain
 * Authority: docs/phase-9/appendices/USERS-DIRECTORY-UX.md · SMOKE-SCENARIO-MAP SMK-P9-03
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildInviteLoginRedirect,
  INVITE_ACCEPT_TEST_IDS,
  readInviteTokenFromSearchParams,
} from "../src/features/users/invite-accept-logic";

describe("invite-accept.spec.ts — Phase 9.4 Web", () => {
  it("WEB-9.4-12 invite entry redirects to login with token (R5)", () => {
    assert.equal(
      buildInviteLoginRedirect("abc-token-123"),
      "/auth/login?invite=abc-token-123"
    );
    assert.equal(buildInviteLoginRedirect("  "), "/auth/login");
  });

  it("WEB-9.4-13 login reads invite query param (R5)", () => {
    const params = new URLSearchParams("invite=token-xyz&returnUrl=%2Fdashboard");
    assert.equal(readInviteTokenFromSearchParams(params), "token-xyz");
    assert.equal(readInviteTokenFromSearchParams(new URLSearchParams()), null);
  });

  it("WEB-9.4-14 invite accept login banner landmark (R5)", () => {
    assert.equal(INVITE_ACCEPT_TEST_IDS.loginInviteBanner, "operator-invite-login-banner");
  });
});
