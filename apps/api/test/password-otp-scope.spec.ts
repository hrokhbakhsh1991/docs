import assert from "node:assert/strict";
import { test } from "node:test";

import {
  InMemoryIdentityRepository,
  type IdentityRepository,
} from "../src/identity/in-memory-identity.repository";
import { hashOtpCode } from "../src/identity/otp-code";
import {
  createMobileOtpChallenge,
  verifyMobileOtp,
  verifyPasswordChangeOtp,
} from "../src/identity/otp.service";

test("a password-change challenge cannot be used as a login challenge", async () => {
  let consumed = false;
  const repo = {
    async findOtpChallenge() {
      return {
        id: "challenge",
        mobile: "09120000000",
        purpose: "password_change",
        codeHash: await hashOtpCode("3287"),
        expiresAt: new Date(Date.now() + 60_000),
        attemptCount: 0,
        used: false,
        tenantId: "tenant-a",
        userId: "user-a",
      };
    },
    async markOtpChallengeUsed() {
      consumed = true;
      return true;
    },
  } as unknown as IdentityRepository;

  await assert.rejects(verifyMobileOtp("challenge", "3287", repo));
  assert.equal(consumed, false);
});

test("a stored password-change OTP retains its identity scope and cannot log in", async () => {
  const repo = new InMemoryIdentityRepository();
  const { challengeId } = await repo.createOtpChallenge("09120000000", await hashOtpCode("3287"), {
    purpose: "password_change",
    tenantId: "tenant-a",
    userId: "user-a",
  });
  const challenge = await repo.findOtpChallenge(challengeId);
  assert.equal(challenge?.purpose, "password_change");
  assert.equal(challenge?.tenantId, "tenant-a");
  assert.equal(challenge?.userId, "user-a");
  await assert.rejects(verifyMobileOtp(challengeId, "3287", repo));
  assert.equal((await repo.findOtpChallenge(challengeId))?.used, false);
});

test("issuing a password-change OTP binds the challenge to its user and tenant", async () => {
  const repo = new InMemoryIdentityRepository();
  const previousSmsEnabled = process.env.SMS_OTP_ENABLED;
  const previousProviderMode = process.env.SMS_PROVIDER_MODE;
  process.env.SMS_OTP_ENABLED = "false";
  process.env.SMS_PROVIDER_MODE = "";
  try {
    const { challengeId } = await createMobileOtpChallenge("09120000000", repo, {
      purpose: "password_change",
      tenantId: "tenant-a",
      userId: "user-a",
      workspaceType: "denali",
    });
    const challenge = await repo.findOtpChallenge(challengeId);
    assert.equal(challenge?.purpose, "password_change");
    assert.equal(challenge?.tenantId, "tenant-a");
    assert.equal(challenge?.userId, "user-a");
  } finally {
    if (previousSmsEnabled === undefined) delete process.env.SMS_OTP_ENABLED;
    else process.env.SMS_OTP_ENABLED = previousSmsEnabled;
    if (previousProviderMode === undefined) delete process.env.SMS_PROVIDER_MODE;
    else process.env.SMS_PROVIDER_MODE = previousProviderMode;
  }
});

test("a normal login challenge is still accepted exactly once", async () => {
  let consumed = false;
  const repo = {
    async findOtpChallenge() {
      return {
        id: "challenge",
        mobile: "09120000000",
        purpose: "login",
        codeHash: await hashOtpCode("3287"),
        expiresAt: new Date(Date.now() + 60_000),
        attemptCount: 0,
        used: consumed,
      };
    },
    async markOtpChallengeUsed() {
      if (consumed) return false;
      consumed = true;
      return true;
    },
  } as unknown as IdentityRepository;

  assert.deepEqual(await verifyMobileOtp("challenge", "3287", repo), {
    mobile: "09120000000",
  });
  await assert.rejects(verifyMobileOtp("challenge", "3287", repo));
});

test("password-change verification is bound to the same user, tenant and mobile", async () => {
  const repo = new InMemoryIdentityRepository();
  const { challengeId } = await repo.createOtpChallenge("09120000000", await hashOtpCode("3287"), {
    purpose: "password_change",
    tenantId: "tenant-a",
    userId: "user-a",
  });
  const scope = { tenantId: "tenant-a", userId: "user-a", mobile: "09120000000" };
  await assert.rejects(
    verifyPasswordChangeOtp(challengeId, "3287", { ...scope, userId: "user-b" }, repo)
  );
  await assert.rejects(
    verifyPasswordChangeOtp(challengeId, "3287", { ...scope, tenantId: "tenant-b" }, repo)
  );
  await assert.rejects(
    verifyPasswordChangeOtp(challengeId, "3287", { ...scope, mobile: "09120000001" }, repo)
  );
  await assert.rejects(verifyPasswordChangeOtp(challengeId, "0000", scope, repo));
  const proof = await verifyPasswordChangeOtp(challengeId, "3287", scope, repo);
  assert.equal(proof.challengeId, challengeId);
  assert.equal((await repo.findOtpChallenge(challengeId))?.used, false);
});

test("login OTPs and consumed OTPs cannot authorize a password change", async () => {
  const repo = new InMemoryIdentityRepository();
  const codeHash = await hashOtpCode("3287");
  const scope = { tenantId: "tenant-a", userId: "user-a", mobile: "09120000000" };
  const login = await repo.createOtpChallenge(scope.mobile, codeHash);
  await assert.rejects(verifyPasswordChangeOtp(login.challengeId, "3287", scope, repo));
  const change = await repo.createOtpChallenge(scope.mobile, codeHash, {
    purpose: "password_change",
    tenantId: scope.tenantId,
    userId: scope.userId,
  });
  assert.equal(await repo.markOtpChallengeUsed(change.challengeId), true);
  await assert.rejects(verifyPasswordChangeOtp(change.challengeId, "3287", scope, repo));
});
