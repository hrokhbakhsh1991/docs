import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aggregateUnhealthySiteCount } from "../src/platform/platform-overview-aggregation";

describe("load platform overview stats aggregation", () => {
  it("sums unhealthy surfaces across active tenants", async () => {
    const count = await aggregateUnhealthySiteCount(
      [
        { id: "tenant-a", status: "active" },
        { id: "tenant-b", status: "active" },
        { id: "tenant-suspended", status: "suspended" },
      ],
      async (tenantId) => {
        if (tenantId === "tenant-a") {
          return {
            results: {
              marketing: { ok: false },
              portal: { ok: true },
              admin: { ok: true },
            },
          };
        }
        if (tenantId === "tenant-b") {
          return {
            results: {
              marketing: { ok: false },
              portal: { ok: false },
              admin: { ok: false },
            },
          };
        }
        throw new Error(`unexpected tenant ${tenantId}`);
      }
    );
    assert.equal(count, 4);
  });

  it("failed sites check contributes zero", async () => {
    const count = await aggregateUnhealthySiteCount([{ id: "tenant-a", status: "active" }], async () => null);
    assert.equal(count, 0);
  });

  it("respects health check limit", async () => {
    const checked: string[] = [];
    const items = Array.from({ length: 5 }, (_, index) => ({
      id: `tenant-${index}`,
      status: "active" as const,
    }));
    const count = await aggregateUnhealthySiteCount(
      items,
      async (tenantId) => {
        checked.push(tenantId);
        return { results: { marketing: { ok: false }, portal: { ok: true }, admin: { ok: true } } };
      },
      2
    );
    assert.equal(checked.length, 2);
    assert.equal(count, 2);
  });
});
