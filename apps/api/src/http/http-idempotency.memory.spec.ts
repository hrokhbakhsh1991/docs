import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import {
  readHttpIdempotencyMemorySizeForTests,
  resetHttpIdempotencyMemoryForTests,
  runIdempotentCreateTour,
} from "./http-idempotency";
import { runWithTenantContext } from "../tenant/tenant-request-context";

const ENV_SNAPSHOT = {
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
  HTTP_IDEMPOTENCY_MEMORY_MAX_ENTRIES: process.env.HTTP_IDEMPOTENCY_MEMORY_MAX_ENTRIES,
  HTTP_IDEMPOTENCY_MEMORY_TTL_MS: process.env.HTTP_IDEMPOTENCY_MEMORY_TTL_MS,
};

afterEach(() => {
  mock.timers.reset();
  process.env.STORAGE_DRIVER = ENV_SNAPSHOT.STORAGE_DRIVER;
  process.env.HTTP_IDEMPOTENCY_MEMORY_MAX_ENTRIES =
    ENV_SNAPSHOT.HTTP_IDEMPOTENCY_MEMORY_MAX_ENTRIES;
  process.env.HTTP_IDEMPOTENCY_MEMORY_TTL_MS = ENV_SNAPSHOT.HTTP_IDEMPOTENCY_MEMORY_TTL_MS;
  resetHttpIdempotencyMemoryForTests();
});

describe("http-idempotency memory bounds (DI-IDEM-02 / DEC-039)", () => {
  it("evicts oldest completed entries when max cap is exceeded", async () => {
    process.env.STORAGE_DRIVER = "memory";
    process.env.HTTP_IDEMPOTENCY_MEMORY_MAX_ENTRIES = "2";
    process.env.HTTP_IDEMPOTENCY_MEMORY_TTL_MS = "60000";

    const tenantId = "a0000000-0000-4000-8000-000000000001";

    await runWithTenantContext(tenantId, async () => {
      for (let i = 0; i < 3; i += 1) {
        await runIdempotentCreateTour(tenantId, `key-${i}`, `hash-${i}`, async () => ({
          id: `tour-${i}`,
          tenantId,
          canonical: { n: i },
        }));
      }
    });

    assert.equal(readHttpIdempotencyMemorySizeForTests(), 2);
  });

  it("expires completed entries after TTL", async () => {
    mock.timers.enable({ apis: ["Date"] });

    process.env.STORAGE_DRIVER = "memory";
    process.env.HTTP_IDEMPOTENCY_MEMORY_MAX_ENTRIES = "16";
    process.env.HTTP_IDEMPOTENCY_MEMORY_TTL_MS = "100";

    const tenantId = "a0000000-0000-4000-8000-000000000002";

    await runWithTenantContext(tenantId, async () => {
      await runIdempotentCreateTour(tenantId, "ttl-key", "ttl-hash", async () => ({
        id: "ttl-tour",
        tenantId,
        canonical: {},
      }));
    });

    assert.equal(readHttpIdempotencyMemorySizeForTests(), 1);
    mock.timers.tick(100);

    await runWithTenantContext(tenantId, async () => {
      await runIdempotentCreateTour(tenantId, "ttl-key-2", "ttl-hash-2", async () => ({
        id: "ttl-tour-2",
        tenantId,
        canonical: {},
      }));
    });

    assert.equal(readHttpIdempotencyMemorySizeForTests(), 1);
  });
});
