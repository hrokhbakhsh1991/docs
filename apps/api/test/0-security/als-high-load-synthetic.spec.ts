/**
 * 0-security — AsyncLocalStorage high-load synthetic verification (no Postgres).
 *
 * Stresses tenant + trace ALS under 50–200 concurrent tasks with alternating
 * tenantIds, nested `runWithTenantContext`, and scheduling hops
 * (`queueMicrotask`, `setImmediate`, `nextTick`, `setTimeout`).
 *
 * Production pattern simulated HTTP-less: trace ALS (outer) → tenant ALS (inner),
 * matching {@link runWithHttpRequestContext} / bind-request-context.ts.
 *
 * @see apps/api/test/0-security/tenant-request-context-isolation.spec.ts — baseline TR suite
 * @see apps/api/test/0-security/async-context-leak.spec.ts — ALS + RLS integration
 * @see apps/api/docs/phase0-audit-report.md — "## AsyncLocalStorage — high-load synthetic verification"
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  getActiveTraceId,
  requireActiveTraceId,
  runWithTraceContext,
} from "../../src/observability/trace-request-context";
import {
  getActiveActorId,
  getActiveTenantId,
  requireActiveTenantId,
  runWithTenantContext,
} from "../../src/tenant/tenant-request-context";
import { integrationTenantId } from "../test-helpers";

const TASKS_PER_TENANT = 100;
const CONCURRENT_TASKS = TASKS_PER_TENANT * 2;

type ProbePhase =
  | "entry"
  | "after-microtask"
  | "after-setImmediate"
  | "after-nextTick"
  | "after-setTimeout-0"
  | "after-nested-inner"
  | "after-nested-restore"
  | "after-random-delay"
  | "final";

type ContextProbe = {
  readonly taskIndex: number;
  readonly expectedTenant: string;
  readonly expectedTrace: string;
  readonly phase: ProbePhase;
  readonly alsTenant: string | undefined;
  readonly alsTrace: string | undefined;
  readonly requiredTenant: string;
  readonly requiredTrace: string;
};

type AlsHighLoadFailure = {
  readonly taskIndex: number;
  readonly phase: ProbePhase;
  readonly expectedTenant: string;
  readonly expectedTrace: string;
  readonly alsTenant: string | undefined;
  readonly alsTrace: string | undefined;
  readonly reason: string;
};

function delayMicrotask(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

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

function delaySetTimeoutMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function captureProbe(
  taskIndex: number,
  expectedTenant: string,
  expectedTrace: string,
  phase: ProbePhase
): ContextProbe {
  return {
    taskIndex,
    expectedTenant,
    expectedTrace,
    phase,
    alsTenant: getActiveTenantId(),
    alsTrace: getActiveTraceId(),
    requiredTenant: requireActiveTenantId(),
    requiredTrace: requireActiveTraceId(),
  };
}

function assertProbeMatches(probe: ContextProbe): void {
  assert.equal(
    probe.alsTenant,
    probe.expectedTenant,
    `task ${probe.taskIndex} @ ${probe.phase}: tenant ALS mismatch (got ${probe.alsTenant ?? "undefined"})`
  );
  assert.equal(
    probe.requiredTenant,
    probe.expectedTenant,
    `task ${probe.taskIndex} @ ${probe.phase}: requireActiveTenantId mismatch`
  );
  assert.equal(
    probe.alsTrace,
    probe.expectedTrace,
    `task ${probe.taskIndex} @ ${probe.phase}: trace ALS mismatch (got ${probe.alsTrace ?? "undefined"})`
  );
  assert.equal(
    probe.requiredTrace,
    probe.expectedTrace,
    `task ${probe.taskIndex} @ ${probe.phase}: requireActiveTraceId mismatch`
  );
}

function collectFailures(
  probes: readonly ContextProbe[],
  tenantA: string,
  tenantB: string
): AlsHighLoadFailure[] {
  const failures: AlsHighLoadFailure[] = [];

  for (const probe of probes) {
    const otherTenant = probe.expectedTenant === tenantA ? tenantB : tenantA;

    if (probe.alsTenant !== probe.expectedTenant) {
      failures.push({
        taskIndex: probe.taskIndex,
        phase: probe.phase,
        expectedTenant: probe.expectedTenant,
        expectedTrace: probe.expectedTrace,
        alsTenant: probe.alsTenant,
        alsTrace: probe.alsTrace,
        reason: probe.alsTenant === otherTenant ? "TENANT_ALS_CROSS_LEAK" : "TENANT_ALS_MISMATCH",
      });
      continue;
    }

    if (probe.alsTrace !== probe.expectedTrace) {
      failures.push({
        taskIndex: probe.taskIndex,
        phase: probe.phase,
        expectedTenant: probe.expectedTenant,
        expectedTrace: probe.expectedTrace,
        alsTenant: probe.alsTenant,
        alsTrace: probe.alsTrace,
        reason: "TRACE_ALS_MISMATCH",
      });
    }
  }

  return failures;
}

/**
 * Simulates HTTP-bound request context: trace outer, tenant inner, with actor metadata.
 * Deep async chain with nested tenant bind and scheduling hops.
 */
async function simulateProductionRequestContext(
  taskIndex: number,
  expectedTenant: string,
  expectedTrace: string,
  otherTenant: string
): Promise<readonly ContextProbe[]> {
  const probes: ContextProbe[] = [];

  return runWithTraceContext(expectedTrace, async () =>
    runWithTenantContext(
      expectedTenant,
      async () => {
        probes.push(captureProbe(taskIndex, expectedTenant, expectedTrace, "entry"));
        assert.equal(getActiveActorId(), `actor-${taskIndex % 10}`);

        await delayMicrotask();
        probes.push(captureProbe(taskIndex, expectedTenant, expectedTrace, "after-microtask"));

        await delaySetImmediate();
        probes.push(captureProbe(taskIndex, expectedTenant, expectedTrace, "after-setImmediate"));

        await delayNextTick();
        probes.push(captureProbe(taskIndex, expectedTenant, expectedTrace, "after-nextTick"));

        await delaySetTimeoutZero();
        probes.push(captureProbe(taskIndex, expectedTenant, expectedTrace, "after-setTimeout-0"));

        await runWithTenantContext(otherTenant, async () => {
          await delaySetImmediate();
          await delayMicrotask();
          probes.push(captureProbe(taskIndex, otherTenant, expectedTrace, "after-nested-inner"));
        });

        await delayNextTick();
        probes.push(captureProbe(taskIndex, expectedTenant, expectedTrace, "after-nested-restore"));

        const jitterMs = (taskIndex % 5) + 1;
        await delaySetTimeoutMs(jitterMs);
        probes.push(captureProbe(taskIndex, expectedTenant, expectedTrace, "after-random-delay"));

        await (async () => {
          await delayMicrotask();
          await delaySetImmediate();
          probes.push(captureProbe(taskIndex, expectedTenant, expectedTrace, "final"));
        })();

        return probes;
      },
      { actorId: `actor-${taskIndex % 10}`, workspaceType: "starter" }
    )
  );
}

describe("0-security ALS high-load synthetic (no Postgres)", () => {
  const tenantA = integrationTenantId();
  const tenantB = integrationTenantId();

  let lastReport: {
    iterationCount: number;
    probeCount: number;
    pass: boolean;
    durationMs: number;
    failures: AlsHighLoadFailure[];
  } | null = null;

  it("ALS-HL-01: 200 concurrent mixed-tenant + trace tasks — no cross-bind", async () => {
    const started = performance.now();

    const bindings = Array.from({ length: CONCURRENT_TASKS }, (_, taskIndex) => ({
      taskIndex,
      expectedTenant: taskIndex % 2 === 0 ? tenantA : tenantB,
      expectedTrace: randomUUID(),
    }));

    const allProbes = await Promise.all(
      bindings.map(({ taskIndex, expectedTenant, expectedTrace }) => {
        const otherTenant = expectedTenant === tenantA ? tenantB : tenantA;
        return simulateProductionRequestContext(
          taskIndex,
          expectedTenant,
          expectedTrace,
          otherTenant
        );
      })
    );

    const flatProbes = allProbes.flat();
    const durationMs = Math.round(performance.now() - started);

    for (const probe of flatProbes) {
      assertProbeMatches(probe);
    }

    const failures = collectFailures(flatProbes, tenantA, tenantB);
    lastReport = {
      iterationCount: CONCURRENT_TASKS,
      probeCount: flatProbes.length,
      pass: failures.length === 0,
      durationMs,
      failures: failures.slice(0, 8),
    };

    process.env.ALS_HIGH_LOAD_SYNTHETIC_REPORT = JSON.stringify(lastReport);

    if (failures.length > 0) {
      assert.fail(
        [
          "CRITICAL_ALS_HIGH_LOAD_LEAK",
          `${failures.length}/${flatProbes.length} probes saw wrong context`,
          failures
            .slice(0, 8)
            .map(
              (f) =>
                `task=${f.taskIndex} phase=${f.phase} reason=${f.reason} tenant=${f.alsTenant ?? "undefined"} trace=${f.alsTrace ?? "undefined"}`
            )
            .join("\n"),
        ].join("\n")
      );
    }

    assert.equal(flatProbes.length, CONCURRENT_TASKS * 9);
    assert.equal(getActiveTenantId(), undefined, "tenant ALS cleared after burst");
    assert.equal(getActiveTraceId(), undefined, "trace ALS cleared after burst");
  });

  it("ALS-HL-02: three sequential waves of 50 concurrent tasks — no bleed between waves", async () => {
    const waveSize = 50;

    for (let wave = 0; wave < 3; wave += 1) {
      const waveProbes = await Promise.all(
        Array.from({ length: waveSize }, (_, i) => {
          const taskIndex = wave * waveSize + i;
          const expectedTenant = taskIndex % 2 === 0 ? tenantA : tenantB;
          const expectedTrace = randomUUID();
          const otherTenant = expectedTenant === tenantA ? tenantB : tenantA;
          return simulateProductionRequestContext(
            taskIndex,
            expectedTenant,
            expectedTrace,
            otherTenant
          );
        })
      );

      const flat = waveProbes.flat();
      for (const probe of flat) {
        assertProbeMatches(probe);
      }

      const failures = collectFailures(flat, tenantA, tenantB);
      assert.equal(failures.length, 0, `wave ${wave}: ${failures.length} ALS failures`);
    }

    assert.equal(getActiveTenantId(), undefined);
    assert.equal(getActiveTraceId(), undefined);
  });

  it("ALS-HL-03: concurrent mix of success and rejection — no cross-task contamination", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 80 }, (_, i) => {
        const expectedTenant = i % 2 === 0 ? tenantA : tenantB;
        const expectedTrace = randomUUID();
        const otherTenant = expectedTenant === tenantA ? tenantB : tenantA;
        const shouldReject = i % 7 === 0;

        return runWithTraceContext(expectedTrace, () =>
          runWithTenantContext(expectedTenant, async () => {
            await delayMicrotask();
            await delaySetImmediate();
            assert.equal(getActiveTenantId(), expectedTenant);
            assert.equal(getActiveTraceId(), expectedTrace);

            if (shouldReject) {
              throw new Error(`ALS_HL_REJECT_${i}`);
            }

            await simulateProductionRequestContext(i, expectedTenant, expectedTrace, otherTenant);
            return expectedTenant;
          })
        );
      })
    );

    const rejections = results.filter((r) => r.status === "rejected");
    const successes = results.filter((r) => r.status === "fulfilled");
    assert.ok(rejections.length > 0);
    assert.ok(successes.length > 0);

    assert.equal(getActiveTenantId(), undefined);
    assert.equal(getActiveTraceId(), undefined);
  });

  it("exposes ALS_HIGH_LOAD_SYNTHETIC_REPORT for audit markdown", () => {
    assert.ok(lastReport, "ALS-HL-01 must populate lastReport");
    const raw = process.env.ALS_HIGH_LOAD_SYNTHETIC_REPORT;
    assert.ok(raw, "ALS_HIGH_LOAD_SYNTHETIC_REPORT must be set");
    const report = JSON.parse(raw) as typeof lastReport;
    assert.ok(report?.pass);
    assert.equal(report?.iterationCount, CONCURRENT_TASKS);
    assert.equal(report?.probeCount, CONCURRENT_TASKS * 9);
  });
});
