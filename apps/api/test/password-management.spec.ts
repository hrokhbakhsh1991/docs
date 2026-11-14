import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryIdentityRepository } from "../src/identity/in-memory-identity.repository";
import { hashOtpCode } from "../src/identity/otp-code";
import { verifyPassword } from "../src/identity/password-hash";
import { changeOwnPassword } from "../src/identity/password-management.service";

test("the owner can change their own password using a scoped OTP", async () => {
  const repo = new InMemoryIdentityRepository();
  const auth = { userId: "user-a", tenantId: "tenant-a", role: "owner", status: "ACTIVE" } as const;
  repo.seedUser({ id: auth.userId, mobile: "09120000000" });
  repo.seedMembership({ ...auth, sessionVersion: 1 });
  const { challengeId } = await repo.createOtpChallenge("09120000000", await hashOtpCode("3287"), {
    purpose: "password_change",
    tenantId: auth.tenantId,
    userId: auth.userId,
  });
  const result = await changeOwnPassword(
    auth,
    1,
    { challengeId, code: "3287", password: "correct horse battery staple" },
    {
      repo,
      signSession: async (claims) => `session-version-${claims.sessionVersion}`,
    }
  );
  assert.equal(result.sessionToken, "session-version-2");
  const hash = await repo.findPasswordHash(auth.userId);
  assert.ok(hash);
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
  assert.equal((await repo.findOtpChallenge(challengeId))?.used, true);
});

test("invalid password and stale sessions never consume a challenge", async () => {
  const repo = new InMemoryIdentityRepository();
  const auth = { userId: "user-a", tenantId: "tenant-a", role: "owner", status: "ACTIVE" } as const;
  repo.seedUser({ id: auth.userId, mobile: "09120000000" });
  repo.seedMembership({ ...auth, sessionVersion: 3 });
  const { challengeId } = await repo.createOtpChallenge("09120000000", await hashOtpCode("3287"), {
    purpose: "password_change",
    tenantId: auth.tenantId,
    userId: auth.userId,
  });
  const dependencies = { repo, signSession: async () => "session" };
  await assert.rejects(
    changeOwnPassword(auth, 3, { challengeId, code: "3287", password: "short" }, dependencies)
  );
  await assert.rejects(
    changeOwnPassword(
      auth,
      2,
      { challengeId, code: "3287", password: "correct horse battery staple" },
      dependencies
    )
  );
  assert.equal((await repo.findOtpChallenge(challengeId))?.used, false);
  assert.equal(await repo.findPasswordHash(auth.userId), null);
});
