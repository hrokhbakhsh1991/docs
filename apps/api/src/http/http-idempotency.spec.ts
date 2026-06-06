import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HTTP_IDEMPOTENCY_TENANT_MISMATCH, runIdempotentCreateTour } from "./http-idempotency";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import { integrationTenantId } from "../../test/test-helpers";

describe("runIdempotentCreateTour ALS invariant (DI-MANUAL-01)", () => {
  it("throws TENANT_CONTEXT_NOT_BOUND when ALS is not bound", async () => {
    await assert.rejects(
      () =>
        runIdempotentCreateTour(integrationTenantId(), "key-1", "hash-1", async () => ({
          id: "tour-1",
          tenantId: integrationTenantId(),
          canonical: {},
        })),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "TENANT_CONTEXT_NOT_BOUND");
        return true;
      }
    );
  });

  it("throws HTTP_IDEMPOTENCY_TENANT_MISMATCH when param tenantId ≠ ALS", async () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();

    await runWithTenantContext(tenantA, async () => {
      await assert.rejects(
        () =>
          runIdempotentCreateTour(tenantB, "key-2", "hash-2", async () => ({
            id: "tour-2",
            tenantId: tenantB,
            canonical: {},
          })),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.equal(error.message, HTTP_IDEMPOTENCY_TENANT_MISMATCH);
          return true;
        }
      );
    });
  });

  it("runs when param tenantId matches ALS (memory driver)", async () => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;

    const tenantId = integrationTenantId();
    const response = { id: "tour-3", tenantId, canonical: { ok: true } };

    await runWithTenantContext(tenantId, async () => {
      const result = await runIdempotentCreateTour(
        tenantId,
        "key-3",
        "hash-3",
        async () => response
      );
      assert.deepEqual(result, response);
    });
  });
});
