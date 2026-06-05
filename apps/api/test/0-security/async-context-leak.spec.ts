import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { withTenantRls } from "../../src/db/with-tenant-rls";
import {
  getActiveTenantId,
  requireActiveTenantId,
  runWithTenantContext,
} from "../../src/tenant/tenant-request-context";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

/** Mixed-tenant burst: 25× tenant A + 25× tenant B. */
const TASKS_PER_TENANT = 25;
const CONCURRENT_TASKS = TASKS_PER_TENANT * 2;

type ContextSnapshot = {
  readonly taskIndex: number;
  readonly expectedTenant: string;
  readonly alsTenant: string | undefined;
  readonly requiredTenant: string;
  readonly alsAfterRls: string | undefined;
  readonly pgSetting: string | null;
  readonly tourCount: number;
};

type AlsLeakFailure = {
  readonly taskIndex: number;
  readonly expectedTenant: string;
  readonly otherTenant: string;
  readonly alsTenant: string | undefined;
  readonly requiredTenant: string;
  readonly alsAfterRls: string | undefined;
  readonly pgSetting: string | null;
  readonly reason: string;
};

function formatLeakDiff(failures: readonly AlsLeakFailure[]): string {
  return failures
    .map((f) =>
      [
        `task=${f.taskIndex}`,
        `reason=${f.reason}`,
        `expected=${f.expectedTenant}`,
        `other=${f.otherTenant}`,
        `alsTenant=${f.alsTenant ?? "undefined"}`,
        `requiredTenant=${f.requiredTenant}`,
        `alsAfterRls=${f.alsAfterRls ?? "undefined"}`,
        `pgSetting=${f.pgSetting ?? "null"}`,
      ].join(" | ")
    )
    .join("\n");
}

function delayViaSetImmediate(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function readPgTenantSetting(
  expectedTenant: string
): Promise<{ pgSetting: string | null; tourCount: number }> {
  return withTenantRls(expectedTenant, async (tx) => {
    const rows = await tx.$queryRaw<Array<{ setting: string | null }>>`
      SELECT current_setting('app.current_tenant_id', true) AS setting
    `;
    const pgSetting = rows[0]?.setting ?? null;
    const tourCount = await tx.tour.count({ where: { tenantId: expectedTenant } });
    return { pgSetting, tourCount };
  });
}

/**
 * Deep async chain — nested awaits + setImmediate before ALS / RLS probes.
 * Each caller must already be inside {@link runWithTenantContext} at the task root.
 */
async function probeTenantContextDeep(
  expectedTenant: string,
  taskIndex: number
): Promise<ContextSnapshot> {
  await Promise.resolve();
  await delayViaSetImmediate();

  const alsTenant = getActiveTenantId();
  const requiredTenant = requireActiveTenantId();

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

  const nested = await (async () => {
    await delayViaSetImmediate();
    return readPgTenantSetting(expectedTenant);
  })();

  const alsAfterRls = getActiveTenantId();

  return {
    taskIndex,
    expectedTenant,
    alsTenant,
    requiredTenant,
    alsAfterRls,
    pgSetting: nested.pgSetting,
    tourCount: nested.tourCount,
  };
}

function collectFailures(
  snapshots: readonly ContextSnapshot[],
  tenantA: string,
  tenantB: string
): AlsLeakFailure[] {
  const failures: AlsLeakFailure[] = [];

  for (const snap of snapshots) {
    const otherTenant = snap.expectedTenant === tenantA ? tenantB : tenantA;

    if (snap.alsTenant !== snap.expectedTenant) {
      failures.push({
        taskIndex: snap.taskIndex,
        expectedTenant: snap.expectedTenant,
        otherTenant,
        alsTenant: snap.alsTenant,
        requiredTenant: snap.requiredTenant,
        alsAfterRls: snap.alsAfterRls,
        pgSetting: snap.pgSetting,
        reason: snap.alsTenant === otherTenant ? "ALS_CROSS_TENANT_LEAK" : "ALS_TENANT_MISMATCH",
      });
      continue;
    }

    if (snap.requiredTenant !== snap.expectedTenant) {
      failures.push({
        taskIndex: snap.taskIndex,
        expectedTenant: snap.expectedTenant,
        otherTenant,
        alsTenant: snap.alsTenant,
        requiredTenant: snap.requiredTenant,
        alsAfterRls: snap.alsAfterRls,
        pgSetting: snap.pgSetting,
        reason:
          snap.requiredTenant === otherTenant
            ? "REQUIRE_ACTIVE_CROSS_TENANT_LEAK"
            : "REQUIRE_ACTIVE_TENANT_MISMATCH",
      });
      continue;
    }

    if (snap.alsAfterRls !== snap.expectedTenant) {
      failures.push({
        taskIndex: snap.taskIndex,
        expectedTenant: snap.expectedTenant,
        otherTenant,
        alsTenant: snap.alsTenant,
        requiredTenant: snap.requiredTenant,
        alsAfterRls: snap.alsAfterRls,
        pgSetting: snap.pgSetting,
        reason:
          snap.alsAfterRls === otherTenant
            ? "ALS_AFTER_RLS_CROSS_TENANT_LEAK"
            : "ALS_AFTER_RLS_MISMATCH",
      });
      continue;
    }

    if (snap.pgSetting !== snap.expectedTenant) {
      failures.push({
        taskIndex: snap.taskIndex,
        expectedTenant: snap.expectedTenant,
        otherTenant,
        alsTenant: snap.alsTenant,
        requiredTenant: snap.requiredTenant,
        alsAfterRls: snap.alsAfterRls,
        pgSetting: snap.pgSetting,
        reason:
          snap.pgSetting === otherTenant ? "PG_SETTING_CROSS_TENANT_LEAK" : "PG_SETTING_MISMATCH",
      });
    }
  }

  return failures;
}

/**
 * AsyncLocalStorage tenant isolation under mixed concurrent tenants (A + B).
 * See docs/phase-5/audits/ALS-CONTEXT-SECURITY-REPORT.md.
 */
describe(
  "0-security async context leak (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const runId = randomUUID().slice(0, 8);
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const priorStorageDriver = process.env.STORAGE_DRIVER;
    let lastIterationCount = 0;
    let lastSnapshotCount = 0;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const admin = getPrismaAdmin();
      for (const [tenantId, label] of [
        [tenantA, "a"],
        [tenantB, "b"],
      ] as const) {
        await admin.tenant.create({
          data: {
            id: tenantId,
            subdomain: `als-leak-${runId}-${label}`,
            workspaceType: "starter",
            theme: {},
          },
        });
      }
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorageDriver;
      const admin = getPrismaAdmin();
      for (const tenantId of [tenantA, tenantB]) {
        await withTenantRls(tenantId, async (tx) => {
          await tx.tour.deleteMany({ where: { tenantId } });
        });
        await admin.tenant.delete({ where: { id: tenantId } });
      }
      await disconnectPrisma();
    });

    it("ALS-CTX-LEAK: 50 concurrent mixed-tenant tasks never cross-bind context", async () => {
      const taskBindings = Array.from({ length: CONCURRENT_TASKS }, (_, taskIndex) => {
        const expectedTenant = taskIndex < TASKS_PER_TENANT ? tenantA : tenantB;
        return { taskIndex, expectedTenant };
      });

      const snapshots = await Promise.all(
        taskBindings.map(({ taskIndex, expectedTenant }) =>
          runWithTenantContext(expectedTenant, async () =>
            probeTenantContextDeep(expectedTenant, taskIndex)
          )
        )
      );

      lastIterationCount = CONCURRENT_TASKS;
      lastSnapshotCount = snapshots.length;

      const failures = collectFailures(snapshots, tenantA, tenantB);
      process.env.ALS_CONTEXT_SECURITY_REPORT = JSON.stringify({
        iterationCount: lastIterationCount,
        snapshotCount: lastSnapshotCount,
        tenantA,
        tenantB,
        pass: failures.length === 0,
        failures: failures.slice(0, 8),
      });

      if (failures.length > 0) {
        assert.fail(
          [
            "CRITICAL_ALS_CONTEXT_LEAK",
            `${failures.length}/${snapshots.length} tasks saw wrong tenant context`,
            "Any ALS_CROSS_TENANT_LEAK or PG_SETTING_CROSS_TENANT_LEAK is a critical bug.",
            formatLeakDiff(failures.slice(0, 12)),
            failures.length > 12 ? `…and ${failures.length - 12} more` : "",
          ]
            .filter(Boolean)
            .join("\n")
        );
      }

      assert.equal(snapshots.length, CONCURRENT_TASKS);
      assert.ok(
        snapshots.every(
          (s) =>
            s.alsTenant === s.expectedTenant &&
            s.requiredTenant === s.expectedTenant &&
            s.alsAfterRls === s.expectedTenant &&
            s.pgSetting === s.expectedTenant
        ),
        "all snapshots must match bound tenant in ALS and Postgres session"
      );
    });

    it("exposes ALS_CONTEXT_SECURITY_REPORT for audit markdown", () => {
      assert.equal(lastIterationCount, CONCURRENT_TASKS);
      assert.equal(lastSnapshotCount, CONCURRENT_TASKS);
      const raw = process.env.ALS_CONTEXT_SECURITY_REPORT;
      assert.ok(raw, "ALS_CONTEXT_SECURITY_REPORT must be set by prior test");
      const report = JSON.parse(raw) as { pass: boolean; iterationCount: number };
      assert.ok(report.pass);
      assert.equal(report.iterationCount, CONCURRENT_TASKS);
    });
  }
);
