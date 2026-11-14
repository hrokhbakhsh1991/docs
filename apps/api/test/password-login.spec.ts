import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryIdentityRepository } from "../src/identity/in-memory-identity.repository";
import { hashPassword } from "../src/identity/password-hash";
import { loginWithPassword } from "../src/identity/password-login.service";

test("password login authenticates an existing active membership without creating accounts", async () => {
  const repo = new InMemoryIdentityRepository();
  repo.seedUser({ id: "user-a", mobile: "09120000000" });
  repo.seedMembership({
    userId: "user-a",
    tenantId: "tenant-a",
    role: "owner",
    status: "ACTIVE",
    sessionVersion: 1,
  });
  const { challengeId } = await repo.createOtpChallenge("09120000000", "otp-hash", {
    purpose: "password_change",
    userId: "user-a",
    tenantId: "tenant-a",
  });
  await repo.commitPasswordCredential({
    userId: "user-a",
    tenantId: "tenant-a",
    mobile: "09120000000",
    challengeId,
    codeHash: "otp-hash",
    passwordHash: await hashPassword("correct horse battery staple"),
    expectedSessionVersion: 1,
  });
  const deps = {
    repo,
    assertAttempt: async () => {},
    assertTenant: async () => {},
    signSession: async (claims: { sessionVersion: number }) => `session-${claims.sessionVersion}`,
  };
  const login = (mobile: string, password: string, tenantId = "tenant-a") =>
    loginWithPassword({ mobile, password, tenantId }, deps);
  assert.equal(
    (await login("09120000000", "correct horse battery staple")).sessionToken,
    "session-2"
  );
  for (const [mobile, password, tenant] of [
    ["09120000000", "wrong password", "tenant-a"],
    ["09120000001", "correct horse battery staple", "tenant-a"],
    ["09120000000", "correct horse battery staple", "tenant-b"],
  ]) {
    await assert.rejects(login(mobile!, password!, tenant!), { code: "PASSWORD_LOGIN_FAILED" });
  }
  assert.equal(await repo.findUserByMobile("09120000001"), null);
});

test("password login fails closed when its abuse-control dependency fails", async () => {
  const repo = new InMemoryIdentityRepository();
  await assert.rejects(
    loginWithPassword(
      { mobile: "09120000000", password: "test password", tenantId: "tenant-a" },
      {
        repo,
        assertTenant: async () => {},
        assertAttempt: async () => {
          throw new Error("rate limiter unavailable");
        },
        signSession: async () => "session",
      }
    ),
    /rate limiter unavailable/
  );
});

test("a password changed during login cannot issue a session for the old password", async () => {
  const repo = new InMemoryIdentityRepository();
  repo.seedUser({ id: "user-a", mobile: "09120000000" });
  repo.seedMembership({
    userId: "user-a",
    tenantId: "tenant-a",
    role: "owner",
    status: "ACTIVE",
    sessionVersion: 2,
  });
  const oldHash = await hashPassword("correct horse battery staple");
  const newHash = await hashPassword("different horse battery staple");
  let reads = 0;
  repo.findPasswordHash = async () => (++reads === 1 ? oldHash : newHash);
  await assert.rejects(
    loginWithPassword(
      { mobile: "09120000000", password: "correct horse battery staple", tenantId: "tenant-a" },
      {
        repo,
        assertTenant: async () => {},
        assertAttempt: async () => {},
        signSession: async () => "session",
      }
    ),
    { code: "PASSWORD_LOGIN_FAILED" }
  );
});
