/**
 * Phase 3 step 4 — per-tenant DB connection budget (DEC-055 / SCAL-DEBT-01).
 */
import assert from "node:assert/strict";
import { after, afterEach, describe, it } from "node:test";

import { runWithTenantContext } from "../../src/tenant/tenant-request-context";
import {
  getActiveTenantDbOpsForTests,
  resetTenantConnectionBudgetForTests,
  TenantDbBudgetExceededError,
  withTenantDbBudget,
} from "../../src/db/tenant-connection-budget";
import { withTenantRls } from "../../src/db/with-tenant-rls";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("tenant connection budget unit (DEC-055)", () => {
  const prevMax = process.env.TENANT_MAX_CONCURRENT_DB_OPS;

  afterEach(() => {
    resetTenantConnectionBudgetForTests();
    if (prevMax === undefined) {
      delete process.env.TENANT_MAX_CONCURRENT_DB_OPS;
    } else {
      process.env.TENANT_MAX_CONCURRENT_DB_OPS = prevMax;
    }
  });

  it("rejects when tenant exceeds concurrent op cap", async () => {
    process.env.TENANT_MAX_CONCURRENT_DB_OPS = "2";
    const tenantId = integrationTenantId();

    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const holdSecond = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    const first = withTenantDbBudget(tenantId, () => holdFirst);
    const second = withTenantDbBudget(tenantId, () => holdSecond);
    await flush();
    assert.equal(getActiveTenantDbOpsForTests(tenantId), 2);

    await assert.rejects(
      () => withTenantDbBudget(tenantId, async () => "blocked"),
      TenantDbBudgetExceededError
    );

    releaseFirst();
    releaseSecond();
    await Promise.all([first, second]);
    assert.equal(getActiveTenantDbOpsForTests(tenantId), 0);
  });

  it("isolates budget counters per tenant", async () => {
    process.env.TENANT_MAX_CONCURRENT_DB_OPS = "1";
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();

    let releaseA!: () => void;
    const holdA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    const runningA = withTenantDbBudget(tenantA, () => holdA);
    await flush();

    await assert.rejects(
      () => withTenantDbBudget(tenantA, async () => "blocked"),
      TenantDbBudgetExceededError
    );

    const runningB = await withTenantDbBudget(tenantB, async () => "ok");
    assert.equal(runningB, "ok");

    releaseA();
    await runningA;
  });
});

describe("tenant connection budget with Postgres", { skip: !hasDatabase }, () => {
  const prevMax = process.env.TENANT_MAX_CONCURRENT_DB_OPS;
  const prevHold = process.env.P5_DB_HOLD_MS;

  after(() => {
    resetTenantConnectionBudgetForTests();
    if (prevMax === undefined) {
      delete process.env.TENANT_MAX_CONCURRENT_DB_OPS;
    } else {
      process.env.TENANT_MAX_CONCURRENT_DB_OPS = prevMax;
    }
    if (prevHold === undefined) {
      delete process.env.P5_DB_HOLD_MS;
    } else {
      process.env.P5_DB_HOLD_MS = prevHold;
    }
  });

  it("tenant B can open TX while tenant A is at cap", async () => {
    process.env.TENANT_MAX_CONCURRENT_DB_OPS = "1";
    process.env.P5_DB_HOLD_MS = "500";

    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();

    const holdA = runWithTenantContext(tenantA, () =>
      withTenantRls(tenantA, async (tx) => tx.$queryRaw`SELECT 1`)
    );

    await flush();

    await assert.rejects(
      () =>
        runWithTenantContext(tenantA, () =>
          withTenantRls(tenantA, async (tx) => tx.$queryRaw`SELECT 1`)
        ),
      TenantDbBudgetExceededError
    );

    const okB = await runWithTenantContext(tenantB, () =>
      withTenantRls(tenantB, async (tx) => tx.$queryRaw`SELECT 1`)
    );
    assert.ok(okB);

    await holdA;
  });
});
