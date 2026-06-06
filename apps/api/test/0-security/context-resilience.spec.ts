import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma } from "../../src/db/prisma";
import { withTenantRls } from "../../src/db/with-tenant-rls";
import { getActiveTenantId, runWithTenantContext } from "../../src/tenant/tenant-request-context";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

function assertAlsClearedOutsideContext(label: string): void {
  assert.equal(
    getActiveTenantId(),
    undefined,
    `${label}: ALS must be undefined outside runWithTenantContext`
  );
}

async function readPgCurrentTenantId(tenantIdForRls: string): Promise<string | null> {
  const rows = await withTenantRls(
    tenantIdForRls,
    async (tx) =>
      tx.$queryRaw<{ setting: string | null }[]>`
      SELECT current_setting('app.current_tenant_id', true) AS setting
    `
  );
  return rows[0]?.setting ?? null;
}

/**
 * TenantContext / ALS resilience after failures — same Node worker, shared Prisma singleton.
 *
 * ALS: {@link runWithTenantContext} / {@link getActiveTenantId}
 * PG: `app.current_tenant_id` via {@link withTenantRls} (transaction-local set_config)
 *
 * Related (legacy): `legacy/apps/api/test/e2e/tenant-context-leak.e2e-spec.ts`
 * Note: `async-context-leak.spec.ts` is not present in this repo; see report cross-links.
 */
describe("0-security context resilience (ALS)", () => {
  const tenantA = integrationTenantId();
  const tenantB = integrationTenantId();

  it("ALS-01: unhandled async rejection clears store after run completes", async () => {
    await assert.rejects(
      () =>
        runWithTenantContext(tenantA, async () => {
          await Promise.resolve();
          await Promise.reject(new Error("ALS_ASYNC_REJECTION"));
        }),
      (error: unknown) => error instanceof Error && error.message === "ALS_ASYNC_REJECTION"
    );
    assertAlsClearedOutsideContext("after async rejection");
  });

  it("ALS-02: synchronous throw clears store after run completes", async () => {
    // Sync throw inside the ALS callback can propagate synchronously from storage.run
    // (not only as a rejected Promise) — catch at test level, then verify store teardown.
    let caught: unknown;
    try {
      await runWithTenantContext(tenantA, () => {
        throw new Error("ALS_SYNC_THROW");
      });
    } catch (error) {
      caught = error;
    }
    assert.ok(
      caught instanceof Error && caught.message === "ALS_SYNC_THROW",
      "expected synchronous throw from wrapped block"
    );
    assertAlsClearedOutsideContext("after sync throw");
  });

  it("ALS-03: Promise.reject without await still clears store when run rejects", async () => {
    await assert.rejects(
      () => runWithTenantContext(tenantA, () => Promise.reject(new Error("ALS_DIRECT_REJECT"))),
      (error: unknown) => error instanceof Error && error.message === "ALS_DIRECT_REJECT"
    );
    assertAlsClearedOutsideContext("after direct Promise.reject");
  });

  it("ALS-04: sequential reuse — 10 random A/B ops, half throw, no stale ALS", async () => {
    const tenants = [tenantA, tenantB];
    for (let i = 0; i < 10; i += 1) {
      const active = tenants[i % 2]!;
      const shouldThrow = i % 2 === 0;
      if (shouldThrow) {
        await assert.rejects(
          () =>
            runWithTenantContext(active, async () => {
              assert.equal(getActiveTenantId(), active);
              throw new Error(`ALS_SEQ_THROW_${i}`);
            }),
          (error: unknown) => error instanceof Error && error.message === `ALS_SEQ_THROW_${i}`
        );
      } else {
        await runWithTenantContext(active, async () => {
          assert.equal(getActiveTenantId(), active);
        });
      }
      assertAlsClearedOutsideContext(`iteration ${i}`);
    }
  });
});

describe(
  "0-security context resilience (ALS + Postgres RLS session)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    let tenantA: string;
    let tenantB: string;

    before(() => {
      tenantA = integrationTenantId();
      tenantB = integrationTenantId();
      assert.notEqual(tenantA, tenantB);
    });

    after(async () => {
      await disconnectPrisma();
    });

    it("PG-01: after tenant A crash, tenant B ALS and PG session are B-only", async () => {
      await assert.rejects(
        () =>
          runWithTenantContext(tenantA, async () => {
            assert.equal(getActiveTenantId(), tenantA);
            throw new Error("TENANT_A_CRASH");
          }),
        (error: unknown) => error instanceof Error && error.message === "TENANT_A_CRASH"
      );
      assertAlsClearedOutsideContext("after tenant A crash");

      await runWithTenantContext(tenantB, async () => {
        assert.equal(getActiveTenantId(), tenantB);
        assert.notEqual(getActiveTenantId(), tenantA);

        const pgTenant = await readPgCurrentTenantId(tenantB);
        assert.equal(
          pgTenant,
          tenantB,
          "withTenantRls must bind app.current_tenant_id to B, not A"
        );
        assert.notEqual(pgTenant, tenantA);
      });
      assertAlsClearedOutsideContext("after tenant B success");
    });

    it("PG-02: interleaved failures and RLS reads never inherit A in B scope", async () => {
      const tenants = [tenantA, tenantB];
      for (let round = 0; round < 6; round += 1) {
        const failing = tenants[round % 2]!;
        const succeeding = tenants[(round + 1) % 2]!;

        await assert.rejects(
          () =>
            runWithTenantContext(failing, async () => {
              await readPgCurrentTenantId(failing);
              throw new Error(`PG_ROUND_FAIL_${round}`);
            }),
          /PG_ROUND_FAIL/
        );
        assertAlsClearedOutsideContext(`post-fail round ${round}`);

        await runWithTenantContext(succeeding, async () => {
          assert.equal(getActiveTenantId(), succeeding);
          const pgTenant = await readPgCurrentTenantId(succeeding);
          assert.equal(pgTenant, succeeding);
          if (succeeding === tenantA) {
            assert.notEqual(pgTenant, tenantB);
          } else {
            assert.notEqual(pgTenant, tenantA);
          }
        });
        assertAlsClearedOutsideContext(`post-success round ${round}`);
      }
    });

    it("PG-03: PG set_config is transaction-scoped — no ambient tenant outside withTenantRls", async () => {
      await withTenantRls(tenantA, async (tx) => {
        const inside = await tx.$queryRaw<{ setting: string | null }[]>`
          SELECT current_setting('app.current_tenant_id', true) AS setting
        `;
        assert.equal(inside[0]?.setting, tenantA);
      });
      assertAlsClearedOutsideContext("ALS unchanged by PG tx alone");

      await runWithTenantContext(tenantB, async () => {
        assert.equal(getActiveTenantId(), tenantB);
      });
      assertAlsClearedOutsideContext("after B ALS without leaking A from prior PG tx");
    });
  }
);
