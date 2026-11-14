import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryIdentityRepository } from "../src/identity/in-memory-identity.repository";

async function fixture() {
  const repo = new InMemoryIdentityRepository();
  repo.seedUser({ id: "user-a", mobile: "09120000000" });
  repo.seedUser({ id: "user-b", mobile: "09120000001" });
  repo.seedMembership({
    userId: "user-a",
    tenantId: "tenant-a",
    role: "owner",
    status: "ACTIVE",
    sessionVersion: 2,
  });
  repo.seedMembership({
    userId: "user-a",
    tenantId: "tenant-b",
    role: "member",
    status: "ACTIVE",
    sessionVersion: 5,
  });
  repo.seedMembership({
    userId: "user-b",
    tenantId: "tenant-a",
    role: "member",
    status: "ACTIVE",
    sessionVersion: 9,
  });
  const { challengeId } = await repo.createOtpChallenge("09120000000", "otp-hash", {
    purpose: "password_change",
    userId: "user-a",
    tenantId: "tenant-a",
  });
  return {
    repo,
    input: {
      userId: "user-a",
      tenantId: "tenant-a",
      mobile: "09120000000",
      challengeId,
      codeHash: "otp-hash",
      passwordHash: "credential-hash",
      expectedSessionVersion: 2,
    },
  };
}

test("credential update consumes the challenge and invalidates only the user's sessions", async () => {
  const { repo, input } = await fixture();
  assert.equal(await repo.commitPasswordCredential(input), 3);
  assert.equal(await repo.findPasswordHash(input.userId), "credential-hash");
  assert.equal((await repo.findOtpChallenge(input.challengeId))?.used, true);
  assert.equal((await repo.findMembership("user-a", "tenant-a"))?.sessionVersion, 3);
  assert.equal((await repo.findMembership("user-a", "tenant-b"))?.sessionVersion, 6);
  assert.equal((await repo.findMembership("user-b", "tenant-a"))?.sessionVersion, 9);
});

test("replay, wrong scope, and stale sessions never modify credentials", async () => {
  const { repo, input } = await fixture();
  assert.equal(await repo.commitPasswordCredential({ ...input, tenantId: "tenant-b" }), null);
  assert.equal(await repo.commitPasswordCredential({ ...input, expectedSessionVersion: 1 }), null);
  assert.equal(await repo.commitPasswordCredential({ ...input, mobile: "09120000001" }), null);
  assert.equal(await repo.findPasswordHash(input.userId), null);
  assert.equal((await repo.findOtpChallenge(input.challengeId))?.used, false);
  const results = await Promise.all([
    repo.commitPasswordCredential(input),
    repo.commitPasswordCredential(input),
  ]);
  assert.equal(results.filter((value) => value !== null).length, 1);
});
