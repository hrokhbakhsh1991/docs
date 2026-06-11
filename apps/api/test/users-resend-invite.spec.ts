/**
 * Phase 9.4 R6 — invite resend dispatches login OTP
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import {
  getIdentityRepository,
  resetIdentityRepositoryForTests,
} from "../src/identity/create-identity-repository";
import { OtpRateLimitedError, resetOtpRateLimitForTests } from "../src/identity/otp-rate-limit";
import { inviteWorkspaceUser, resendPendingInvite } from "../src/identity/users.service";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { seedOperatorIdentityFixture } from "./fixtures/operator-identity-fixture";
import { installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

const ownerAuth = {
  userId: OPERATOR_SMOKE.ownerUserId,
  tenantId: OPERATOR_SMOKE.tenantId,
  role: "owner" as const,
  status: "ACTIVE" as const,
  workspaceId: "ws-operator-smoke",
};

describe("users-resend-invite.spec.ts — R6", () => {
  before(() => {
    resetIdentityRepositoryForTests();
    seedOperatorIdentityFixture();
  });

  it("API-9.4-33 resendPendingInvite dispatches OTP and returns otpSent (R6)", async () => {
    resetOtpRateLimitForTests();
    const repo = getIdentityRepository();
    const created = await inviteWorkspaceUser(
      ownerAuth,
      { phone: "+15550006666", role: "member", nameNote: "R6 probe" },
      repo
    );

    const resent = await resendPendingInvite(ownerAuth, created.inviteId, repo);
    assert.equal(resent.inviteId, created.inviteId);
    assert.equal(resent.phone, "+15550006666");
    assert.equal(resent.role, "member");
    assert.equal(resent.status, "INVITED");
    assert.equal(resent.otpSent, true);
  });

  it("API-9.4-34 resendPendingInvite shares login OTP rate limit (R6)", async () => {
    resetOtpRateLimitForTests();
    const repo = getIdentityRepository();
    const created = await inviteWorkspaceUser(
      ownerAuth,
      { phone: "+15550007777", role: "admin" },
      repo
    );

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const row = await resendPendingInvite(ownerAuth, created.inviteId, repo);
      assert.equal(row.otpSent, true);
    }

    await assert.rejects(
      () => resendPendingInvite(ownerAuth, created.inviteId, repo),
      (error: unknown) => error instanceof OtpRateLimitedError
    );
  });
});
