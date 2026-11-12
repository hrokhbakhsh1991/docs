import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  assertPlatformImpersonationSessionActive,
  consumePlatformImpersonationExchange,
  PlatformImpersonationStateUnavailableError,
  PlatformImpersonationTokenConsumedError,
  resetPlatformImpersonationSessionStateForTests,
  revokePlatformImpersonationSession,
  setPlatformImpersonationRedisClientForTests,
  type PlatformImpersonationRedisCommands,
} from "../src/platform/platform-impersonation-session-state.ts";

function createMemoryRedis(): PlatformImpersonationRedisCommands {
  const values = new Map<string, string>();
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async setWithTtl(key, value) {
      values.set(key, value);
      return "OK";
    },
    async setIfAbsentWithTtl(key, value) {
      if (values.has(key)) {
        return null;
      }
      values.set(key, value);
      return "OK";
    },
  };
}

afterEach(() => {
  resetPlatformImpersonationSessionStateForTests();
});

describe("platform impersonation session state", () => {
  it("allows exactly one exchange for a jti", async () => {
    setPlatformImpersonationRedisClientForTests(createMemoryRedis());
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    await consumePlatformImpersonationExchange("exchange-once", expiresAt);
    await assert.rejects(
      () => consumePlatformImpersonationExchange("exchange-once", expiresAt),
      PlatformImpersonationTokenConsumedError
    );
  });

  it("revokes an active session and rejects use after revocation", async () => {
    setPlatformImpersonationRedisClientForTests(createMemoryRedis());
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    await consumePlatformImpersonationExchange("session-to-revoke", expiresAt);
    await assertPlatformImpersonationSessionActive("session-to-revoke");
    await revokePlatformImpersonationSession("session-to-revoke", expiresAt);
    await assert.rejects(
      () => assertPlatformImpersonationSessionActive("session-to-revoke"),
      PlatformImpersonationTokenConsumedError
    );
  });

  it("fails closed if the exchanged marker is missing after Redis state loss", async () => {
    setPlatformImpersonationRedisClientForTests(createMemoryRedis());
    await assert.rejects(
      () => assertPlatformImpersonationSessionActive("lost-state-session"),
      PlatformImpersonationTokenConsumedError
    );
  });

  it("fails closed when the shared state store is not configured", async () => {
    const oldRedisUrl = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    try {
      await assert.rejects(
        () => assertPlatformImpersonationSessionActive("state-required"),
        PlatformImpersonationStateUnavailableError
      );
    } finally {
      if (oldRedisUrl === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = oldRedisUrl;
    }
  });

  it("maps Redis connection failures to a fail-closed service error", async () => {
    setPlatformImpersonationRedisClientForTests({
      async get() {
        throw new Error("private redis connection detail");
      },
      async setWithTtl() {
        throw new Error("private redis connection detail");
      },
      async setIfAbsentWithTtl() {
        throw new Error("private redis connection detail");
      },
    });
    await assert.rejects(
      () => assertPlatformImpersonationSessionActive("state-backend-error"),
      PlatformImpersonationStateUnavailableError
    );
  });
});
