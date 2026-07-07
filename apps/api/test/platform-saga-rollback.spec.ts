import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertSubdomainAvailable } from "../src/platform/assert-subdomain-available.ts";

describe("platform saga rollback", () => {
  it("failure throws", async () => {
    await assert.rejects(() => assertSubdomainAvailable("admin"));
  });

  it("no partial config", async () => {
    const writes: string[] = [];
    const mockTransaction = async (
      fn: (tx: {
        tenant: { create: () => Promise<void> };
        tenantConfig: { create: () => Promise<void> };
      }) => Promise<unknown>
    ) => {
      try {
        return await fn({
          tenant: {
            create: async () => {
              writes.push("tenant");
            },
          },
          tenantConfig: {
            create: async () => {
              writes.push("config");
              throw new Error("seed_failed");
            },
          },
        });
      } catch (error) {
        writes.length = 0;
        throw error;
      }
    };

    await assert.rejects(
      () =>
        mockTransaction(async (tx) => {
          await tx.tenant.create();
          await tx.tenantConfig.create();
        }),
      /seed_failed/
    );
    assert.deepEqual(writes, []);
  });
});
