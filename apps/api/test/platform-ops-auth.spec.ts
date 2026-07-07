import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertPlatformOpsAuth } from "../src/platform/assert-platform-ops-auth.ts";
import { readPlatformOpsBearerToken } from "../src/platform/read-platform-ops-bearer-token.ts";
import { PlatformUnauthorized, PlatformForbidden } from "../src/platform/platform.errors.ts";

describe("readPlatformOpsBearerToken", () => {
  it("defaults to platform-ops", () => {
    assert.equal(readPlatformOpsBearerToken(""), "platform-ops");
  });
});

describe("assertPlatformOpsAuth", () => {
  const mockRepository = {
    async findByPhone() {
      return null;
    },
    async listAll() {
      return [];
    },
    async upsert() {
      throw new Error("not used");
    },
  };

  it("allowed - returns owner context with valid auth and phone", async () => {
    const headers = {
      Authorization: `Bearer ${readPlatformOpsBearerToken()}`,
      "X-Platform-Ops-Phone": "+989121234567",
    };
    const result = await assertPlatformOpsAuth(headers, { repository: mockRepository });
    assert.deepEqual(result.roles, ["owner"]);
    assert.equal(result.actorId, "+989121234567");
  });

  it("401 - throws PlatformUnauthorized without auth header", async () => {
    const headers = {
      "X-Platform-Ops-Phone": "+989121234567",
    };
    await assert.rejects(
      () => assertPlatformOpsAuth(headers, { repository: mockRepository }),
      PlatformUnauthorized
    );
  });

  it("401 - throws PlatformUnauthorized with wrong bearer", async () => {
    const headers = {
      Authorization: "Bearer wrong-token",
      "X-Platform-Ops-Phone": "+989121234567",
    };
    await assert.rejects(
      () => assertPlatformOpsAuth(headers, { repository: mockRepository }),
      PlatformUnauthorized
    );
  });

  it("403 - throws PlatformForbidden with invalid phone", async () => {
    const oldEnv = process.env.PLATFORM_OPS_PHONES;
    process.env.PLATFORM_OPS_PHONES = "+989129999999";

    const headers = {
      Authorization: `Bearer ${readPlatformOpsBearerToken()}`,
      "X-Platform-Ops-Phone": "+989121234567",
    };

    try {
      await assert.rejects(
        () => assertPlatformOpsAuth(headers, { repository: mockRepository }),
        PlatformForbidden
      );
    } finally {
      if (oldEnv === undefined) {
        delete process.env.PLATFORM_OPS_PHONES;
      } else {
        process.env.PLATFORM_OPS_PHONES = oldEnv;
      }
    }
  });
});
