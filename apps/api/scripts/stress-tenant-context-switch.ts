#!/usr/bin/env node
/**
 * Stress tenant AsyncLocalStorage under rapid A → B → A context switches.
 *
 * Probes after each bind: microtask, setImmediate, nested Promise.all.
 * Detects: stale ALS after run completes, wrong tenant mid-flight, cross-tenant leak.
 *
 * Complements verify-als-request-cleanup.ts (HTTP post-request teardown).
 *
 * Run:
 *   cd apps/api && NODE_ENV=test npx tsx scripts/stress-tenant-context-switch.ts
 *
 * Exit 0 = pass; exit 1 = violations recorded (JSON summary on stderr).
 */
import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";

import { runWithHttpRequestContext } from "../src/http/bind-request-context";
import {
  getActiveTenantId,
  requireActiveTenantId,
  runWithTenantContext,
} from "../src/tenant/tenant-request-context";
import { integrationTenantId } from "../test/test-helpers";

type ViolationKind = "stale-after-run" | "wrong-mid-flight" | "cross-tenant-leak";

type Violation = {
  readonly phase: string;
  readonly kind: ViolationKind;
  readonly expected?: string;
  readonly observed?: string;
  readonly otherTenant?: string;
  readonly iteration?: number;
  readonly taskIndex?: number;
  readonly note?: string;
};

const violations: Violation[] = [];

const SEQUENTIAL_ABA_ITERATIONS = 500;
const CONCURRENT_ABA_TASKS = 200;
const CONCURRENT_MIX_TASKS = 100;
const HTTP_ABA_ITERATIONS = 50;

function record(violation: Violation): void {
  violations.push(violation);
}

function snapshotTenant(): string | undefined {
  return getActiveTenantId();
}

function assertCleared(phase: string, iteration?: number): void {
  const observed = snapshotTenant();
  if (observed !== undefined) {
    record({
      phase,
      kind: "stale-after-run",
      observed,
      iteration,
      note: "ALS must be undefined outside runWithTenantContext",
    });
  }
}

function assertNotOtherTenant(
  phase: string,
  expected: string,
  other: string,
  extra?: Pick<Violation, "iteration" | "taskIndex" | "note">
): void {
  const observed = snapshotTenant();
  if (observed === other) {
    record({
      phase,
      kind: "cross-tenant-leak",
      expected,
      observed,
      otherTenant: other,
      ...extra,
    });
  }
}

function assertMatches(
  phase: string,
  expected: string,
  extra?: Pick<Violation, "iteration" | "taskIndex" | "note">
): void {
  const observed = snapshotTenant();
  if (observed !== expected) {
    record({
      phase,
      kind: "wrong-mid-flight",
      expected,
      observed,
      ...extra,
    });
  }
}

function requireMatches(
  phase: string,
  expected: string,
  extra?: Pick<Violation, "iteration" | "taskIndex" | "note">
): void {
  try {
    const required = requireActiveTenantId();
    if (required !== expected) {
      record({
        phase,
        kind: "wrong-mid-flight",
        expected,
        observed: required,
        note: "requireActiveTenantId mismatch",
        ...extra,
      });
    }
  } catch {
    record({
      phase,
      kind: "wrong-mid-flight",
      expected,
      observed: undefined,
      note: "requireActiveTenantId threw TENANT_CONTEXT_NOT_BOUND",
      ...extra,
    });
  }
}

async function delayMicrotask(): Promise<void> {
  await Promise.resolve();
}

async function delaySetImmediate(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

async function probeAsyncHops(
  phase: string,
  expected: string,
  other: string,
  extra?: Pick<Violation, "iteration" | "taskIndex">
): Promise<void> {
  assertMatches(`${phase}:sync`, expected, extra);
  assertNotOtherTenant(`${phase}:sync-not-other`, expected, other, extra);

  await delayMicrotask();
  assertMatches(`${phase}:microtask`, expected, extra);
  assertNotOtherTenant(`${phase}:microtask-not-other`, expected, other, extra);
  requireMatches(`${phase}:microtask-require`, expected, extra);

  await delaySetImmediate();
  assertMatches(`${phase}:setImmediate`, expected, extra);
  assertNotOtherTenant(`${phase}:setImmediate-not-other`, expected, other, extra);
  requireMatches(`${phase}:setImmediate-require`, expected, extra);

  await Promise.all([
    (async () => {
      await delayMicrotask();
      assertMatches(`${phase}:concurrent-microtask`, expected, extra);
    })(),
    (async () => {
      await delaySetImmediate();
      assertMatches(`${phase}:concurrent-setImmediate`, expected, extra);
    })(),
    (async () => {
      await new Promise<void>((resolve) => {
        process.nextTick(() => {
          assertMatches(`${phase}:concurrent-nextTick`, expected, extra);
          resolve();
        });
      });
    })(),
  ]);
}

async function runAbaCycle(
  phase: string,
  tenantA: string,
  tenantB: string,
  extra?: Pick<Violation, "iteration" | "taskIndex">
): Promise<void> {
  await runWithTenantContext(tenantA, async () => {
    await probeAsyncHops(`${phase}:A`, tenantA, tenantB, extra);
  });
  assertCleared(`${phase}:after-A`, extra?.iteration);

  await runWithTenantContext(tenantB, async () => {
    await probeAsyncHops(`${phase}:B`, tenantB, tenantA, extra);
  });
  assertCleared(`${phase}:after-B`, extra?.iteration);

  await runWithTenantContext(tenantA, async () => {
    await probeAsyncHops(`${phase}:A-return`, tenantA, tenantB, extra);
    assertNotOtherTenant(`${phase}:A-return-not-B`, tenantA, tenantB, extra);
  });
  assertCleared(`${phase}:after-ABA`, extra?.iteration);
}

async function verifySequentialAba(tenantA: string, tenantB: string): Promise<void> {
  assertCleared("seq:baseline");

  for (let i = 0; i < SEQUENTIAL_ABA_ITERATIONS; i += 1) {
    await runAbaCycle("seq-aba", tenantA, tenantB, { iteration: i });
  }

  assertCleared("seq:final");
}

async function verifyConcurrentAba(tenantA: string, tenantB: string): Promise<void> {
  assertCleared("conc-aba:baseline");

  await Promise.all(
    Array.from({ length: CONCURRENT_ABA_TASKS }, (_, taskIndex) =>
      runAbaCycle("conc-aba", tenantA, tenantB, { taskIndex })
    )
  );

  assertCleared("conc-aba:final");
}

async function verifyConcurrentMix(tenantA: string, tenantB: string): Promise<void> {
  assertCleared("conc-mix:baseline");

  await Promise.all(
    Array.from({ length: CONCURRENT_MIX_TASKS }, (_, taskIndex) => {
      const expected = taskIndex % 2 === 0 ? tenantA : tenantB;
      const other = expected === tenantA ? tenantB : tenantA;
      return runWithTenantContext(expected, async () => {
        await probeAsyncHops("conc-mix", expected, other, { taskIndex });
        assertNotOtherTenant("conc-mix:not-other", expected, other, { taskIndex });
        return requireActiveTenantId();
      });
    })
  );

  assertCleared("conc-mix:final");
}

function httpAuth(tenantId: string) {
  return {
    tenantId,
    userId: "stress-user",
    role: "admin" as const,
    membershipStatus: "ACTIVE" as const,
    workspaceId: "ws-stress",
  };
}

async function verifyHttpRequestAba(tenantA: string, tenantB: string): Promise<void> {
  assertCleared("http-aba:baseline");

  for (let i = 0; i < HTTP_ABA_ITERATIONS; i += 1) {
    const traceId = randomUUID();
    const req = {
      headers: { "x-correlation-id": traceId },
    } as IncomingMessage;

    await runWithHttpRequestContext(req, httpAuth(tenantA), async () => {
      await probeAsyncHops(`http-aba:${i}:A`, tenantA, tenantB, { iteration: i });
    });
    assertCleared(`http-aba:${i}:after-A`, i);

    await runWithHttpRequestContext(req, httpAuth(tenantB), async () => {
      await probeAsyncHops(`http-aba:${i}:B`, tenantB, tenantA, { iteration: i });
    });
    assertCleared(`http-aba:${i}:after-B`, i);

    await runWithHttpRequestContext(req, httpAuth(tenantA), async () => {
      await probeAsyncHops(`http-aba:${i}:A-return`, tenantA, tenantB, { iteration: i });
      assertNotOtherTenant(`http-aba:${i}:A-return-not-B`, tenantA, tenantB, { iteration: i });
    });
    assertCleared(`http-aba:${i}:after-ABA`, i);
  }

  assertCleared("http-aba:final");
}

function printReport(startedAt: number): void {
  const elapsedMs = Date.now() - startedAt;
  const pass = violations.length === 0;

  const summary = {
    pass,
    elapsedMs,
    violations: violations.length,
    violationKinds: {
      staleAfterRun: violations.filter((v) => v.kind === "stale-after-run").length,
      wrongMidFlight: violations.filter((v) => v.kind === "wrong-mid-flight").length,
      crossTenantLeak: violations.filter((v) => v.kind === "cross-tenant-leak").length,
    },
    phases: {
      sequentialAba: SEQUENTIAL_ABA_ITERATIONS,
      concurrentAba: CONCURRENT_ABA_TASKS,
      concurrentMix: CONCURRENT_MIX_TASKS,
      httpAba: HTTP_ABA_ITERATIONS,
    },
    samples: violations.slice(0, 10),
    complementaryScript: "scripts/verify-als-request-cleanup.ts",
  };

  process.stderr.write("\n--- stress-tenant-context-switch ---\n");
  if (pass) {
    process.stderr.write(
      `PASS: ${SEQUENTIAL_ABA_ITERATIONS} sequential + ${CONCURRENT_ABA_TASKS} concurrent ABA + ${CONCURRENT_MIX_TASKS} mixed + ${HTTP_ABA_ITERATIONS} HTTP ABA — no ALS violations (${elapsedMs}ms).\n`
    );
  } else {
    process.stderr.write(`FAIL: ${violations.length} violation(s) recorded.\n`);
    for (const row of violations.slice(0, 20)) {
      process.stderr.write(formatViolation(row));
    }
    if (violations.length > 20) {
      process.stderr.write(`  … and ${violations.length - 20} more (see JSON).\n`);
    }
  }
  process.stderr.write("\nJSON:\n");
  process.stderr.write(`${JSON.stringify(summary, null, 2)}\n`);
}

function formatViolation(row: Violation): string {
  return `  phase=${row.phase} kind=${row.kind} expected=${row.expected ?? "—"} observed=${row.observed ?? "—"} iter=${row.iteration ?? "—"} task=${row.taskIndex ?? "—"} ${row.note ?? ""}\n`;
}

async function main(): Promise<void> {
  process.env.NODE_ENV ??= "test";

  const startedAt = Date.now();
  const tenantA = integrationTenantId();
  const tenantB = integrationTenantId();

  if (tenantA === tenantB) {
    throw new Error("stress-tenant-context-switch: tenantA and tenantB must differ");
  }

  await verifySequentialAba(tenantA, tenantB);
  await verifyConcurrentAba(tenantA, tenantB);
  await verifyConcurrentMix(tenantA, tenantB);
  await verifyHttpRequestAba(tenantA, tenantB);

  printReport(startedAt);

  if (violations.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`stress-tenant-context-switch: fatal: ${message}\n`);
  process.exitCode = 1;
});
