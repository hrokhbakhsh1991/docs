import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  hashPlatformIdempotentRequest,
  PLATFORM_IDEMPOTENCY_PAYLOAD_MISMATCH,
  resetPlatformIdempotencyMemoryForTests,
  runWithPlatformIdempotency,
} from "../src/routes/platform/tenants-create-idempotency";

describe("Platform tenant idempotency", () => {
  beforeEach(() => {
    resetPlatformIdempotencyMemoryForTests();
  });

  it("double POST same id returns same tenant id", async () => {
    const idempotencyKey = "test-key-001";
    const requestHash = hashPlatformIdempotentRequest(
      "POST",
      "/platform/v1/tenants",
      '{"subdomain":"test"}'
    );

    let callCount = 0;
    const execute = async () => {
      callCount += 1;
      return { tenantId: "tenant-123", subdomain: "test" };
    };

    const result1 = await runWithPlatformIdempotency(idempotencyKey, requestHash, execute);
    const result2 = await runWithPlatformIdempotency(idempotencyKey, requestHash, execute);

    assert.equal(callCount, 1, "execute should be called only once");
    assert.equal(result1.tenantId, "tenant-123");
    assert.equal(result2.tenantId, "tenant-123");
    assert.deepEqual(result1, result2, "both responses should be identical");
  });

  it("same key different payload throws mismatch", async () => {
    const idempotencyKey = "test-key-002";
    const hash1 = hashPlatformIdempotentRequest(
      "POST",
      "/platform/v1/tenants",
      '{"subdomain":"test1"}'
    );
    const hash2 = hashPlatformIdempotentRequest(
      "POST",
      "/platform/v1/tenants",
      '{"subdomain":"test2"}'
    );

    await runWithPlatformIdempotency(idempotencyKey, hash1, async () => ({ tenantId: "t1" }));

    await assert.rejects(
      async () =>
        runWithPlatformIdempotency(idempotencyKey, hash2, async () => ({ tenantId: "t2" })),
      (err: Error) => err.message === PLATFORM_IDEMPOTENCY_PAYLOAD_MISMATCH
    );
  });
});

// Made with Bob
