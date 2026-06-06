/**
 * 0-security — pure AsyncLocalStorage tenant isolation (no Postgres).
 *
 * Complements {@link context-resilience.spec.ts} (failure teardown) and
 * {@link async-context-leak.spec.ts} (mixed-tenant + RLS integration).
 *
 * @see apps/api/src/tenant/tenant-request-context.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getActiveActorId,
  getActiveTenantId,
  getActiveWorkspaceType,
  requireActiveTenantId,
  runWithTenantContext,
} from "../../src/tenant/tenant-request-context";
import { integrationTenantId } from "../test-helpers";

const TASKS_PER_TENANT = 25;
const CONCURRENT_TASKS = TASKS_PER_TENANT * 2;

function delaySetImmediate(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function delayNextTick(): Promise<void> {
  return new Promise((resolve) => {
    process.nextTick(resolve);
  });
}

function delaySetTimeoutZero(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function assertAlsCleared(label: string): void {
  assert.equal(
    getActiveTenantId(),
    undefined,
    `${label}: ALS must be undefined outside runWithTenantContext`
  );
}

/** Deep async chain with scheduling hops before probing ALS. */
async function probeTenantAfterAsyncHops(expectedTenant: string): Promise<string> {
  await Promise.resolve();
  await delaySetImmediate();
  await delayNextTick();
  await delaySetTimeoutZero();
  await delaySetImmediate();

  const mid = getActiveTenantId();
  assert.equal(mid, expectedTenant, "ALS must match bound tenant mid-chain");

  await (async () => {
    await delayNextTick();
    await delaySetImmediate();
    assert.equal(requireActiveTenantId(), expectedTenant);
  })();

  return requireActiveTenantId();
}

describe("0-security tenant-request-context isolation (unit)", () => {
  const tenantA = integrationTenantId();
  const tenantB = integrationTenantId();

  it("TR-01: missing ALS — getActiveTenantId undefined, requireActiveTenantId throws", () => {
    assertAlsCleared("baseline");
    assert.throws(
      () => requireActiveTenantId(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "TENANT_CONTEXT_NOT_BOUND");
        return true;
      }
    );
  });

  it("TR-02: empty or whitespace tenantId rejected at bind time", () => {
    assert.throws(
      () => runWithTenantContext("", async () => undefined),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "TENANT_CONTEXT_TENANT_ID_REQUIRED");
        return true;
      }
    );
    assert.throws(
      () => runWithTenantContext("   ", async () => undefined),
      /TENANT_CONTEXT_TENANT_ID_REQUIRED/
    );
    assertAlsCleared("after invalid bind attempts");
  });

  it("TR-03: tenantId trimmed on bind", async () => {
    const padded = `  ${tenantA}  `;
    await runWithTenantContext(padded, async () => {
      assert.equal(getActiveTenantId(), tenantA);
      assert.equal(requireActiveTenantId(), tenantA);
    });
    assertAlsCleared("after trim bind");
  });

  it("TR-04: actorId and workspaceType optional fields on store", async () => {
    await runWithTenantContext(
      tenantA,
      async () => {
        assert.equal(getActiveActorId(), "actor-1");
        assert.equal(getActiveWorkspaceType(), "starter");
      },
      { actorId: "  actor-1  ", workspaceType: " starter " }
    );
    assertAlsCleared("after options bind");
  });

  it("TR-05: Promise.all — 50 concurrent mixed-tenant tasks never cross-bind", async () => {
    const bindings = Array.from({ length: CONCURRENT_TASKS }, (_, taskIndex) => ({
      taskIndex,
      expectedTenant: taskIndex < TASKS_PER_TENANT ? tenantA : tenantB,
    }));

    const observed = await Promise.all(
      bindings.map(async ({ taskIndex, expectedTenant }) => {
        return runWithTenantContext(expectedTenant, async () => {
          const otherTenant = expectedTenant === tenantA ? tenantB : tenantA;
          const resolved = await probeTenantAfterAsyncHops(expectedTenant);
          assert.notEqual(resolved, otherTenant, `task ${taskIndex}: must not see other tenant`);
          return { taskIndex, expectedTenant, observedTenant: resolved };
        });
      })
    );

    assert.equal(observed.length, CONCURRENT_TASKS);
    for (const row of observed) {
      assert.equal(
        row.observedTenant,
        row.expectedTenant,
        `task ${row.taskIndex}: ALS leak or mismatch`
      );
    }
    assertAlsCleared("after Promise.all burst");
  });

  it("TR-06: nested runWithTenantContext — inner wins, outer restored after inner async", async () => {
    await runWithTenantContext(tenantA, async () => {
      assert.equal(getActiveTenantId(), tenantA);

      await runWithTenantContext(tenantB, async () => {
        await delaySetImmediate();
        assert.equal(getActiveTenantId(), tenantB);
        assert.notEqual(getActiveTenantId(), tenantA);
      });

      await delayNextTick();
      assert.equal(getActiveTenantId(), tenantA, "outer tenant restored after nested async");
      assert.notEqual(getActiveTenantId(), tenantB);
    });
    assertAlsCleared("after nested runs");
  });

  it("TR-07: parent context restored only after child promise fully settles", async () => {
    let innerDone = false;

    await runWithTenantContext(tenantA, async () => {
      const inner = runWithTenantContext(tenantB, async () => {
        await delaySetImmediate();
        await delaySetTimeoutZero();
        innerDone = true;
      });

      assert.equal(getActiveTenantId(), tenantA, "outer still active while inner pending");
      await inner;
      assert.ok(innerDone);
      assert.equal(getActiveTenantId(), tenantA, "outer restored after inner promise settles");
    });
    assertAlsCleared("after parent/child sequencing");
  });

  it("TR-08: setImmediate and nextTick hops preserve bound tenant", async () => {
    await runWithTenantContext(tenantA, async () => {
      await delaySetImmediate();
      assert.equal(getActiveTenantId(), tenantA);

      await new Promise<void>((resolve) => {
        setImmediate(() => {
          assert.equal(getActiveTenantId(), tenantA);
          process.nextTick(() => {
            assert.equal(requireActiveTenantId(), tenantA);
            resolve();
          });
        });
      });
    });
    assertAlsCleared("after scheduling hops");
  });

  it("TR-09: concurrent mix of success and rejection — no ALS bleed between tasks", async () => {
    const tenants = [tenantA, tenantB];

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => {
        const active = tenants[i % 2]!;
        const shouldReject = i % 3 === 0;
        return runWithTenantContext(active, async () => {
          await probeTenantAfterAsyncHops(active);
          if (shouldReject) {
            throw new Error(`TR09_REJECT_${i}`);
          }
          return active;
        });
      })
    );

    const rejections = results.filter((r) => r.status === "rejected");
    const successes = results.filter((r) => r.status === "fulfilled");
    assert.ok(rejections.length > 0);
    assert.ok(successes.length > 0);

    for (const row of successes) {
      assert.equal(row.status, "fulfilled");
      assert.ok(tenants.includes(row.value));
    }

    assertAlsCleared("after mixed concurrent success/reject");
  });

  it("TR-10: rejection inside run clears ALS when promise settles", async () => {
    await assert.rejects(
      () =>
        runWithTenantContext(tenantA, async () => {
          await delaySetImmediate();
          assert.equal(getActiveTenantId(), tenantA);
          throw new Error("TR10_ASYNC_REJECT");
        }),
      (error: unknown) => error instanceof Error && error.message === "TR10_ASYNC_REJECT"
    );
    assertAlsCleared("after async rejection");
  });

  it("TR-11: sync throw inside run clears ALS", async () => {
    let caught: unknown;
    try {
      await runWithTenantContext(tenantA, () => {
        assert.equal(getActiveTenantId(), tenantA);
        throw new Error("TR11_SYNC_THROW");
      });
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof Error && caught.message === "TR11_SYNC_THROW");
    assertAlsCleared("after sync throw");
  });

  it("TR-12: sequential A/B after nested inner rejection restores outer then clears", async () => {
    await runWithTenantContext(tenantA, async () => {
      await assert.rejects(
        () =>
          runWithTenantContext(tenantB, async () => {
            await delayNextTick();
            throw new Error("TR12_INNER_REJECT");
          }),
        /TR12_INNER_REJECT/
      );
      assert.equal(getActiveTenantId(), tenantA, "outer tenant after inner rejection");
    });
    assertAlsCleared("after nested rejection");

    await runWithTenantContext(tenantB, async () => {
      assert.equal(getActiveTenantId(), tenantB);
    });
    assertAlsCleared("after follow-up bind");
  });
});
