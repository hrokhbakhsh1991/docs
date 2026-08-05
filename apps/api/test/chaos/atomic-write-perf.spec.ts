/**
 * Phase 5 hardened gate — atomic write latency under concurrency.
 *
 * Two tiers:
 * 1. Serial baseline (10 ops after warmup): p95 < P5_SERIAL_PERF_GATE_MS (default 100) —
 *    proves atomic path is fast uncontended. GHA shared runners after a long suite may need a
 *    higher ceiling (document in HARDENED-GATE-REPORT / phase-6-gate fast-closure env).
 * 2. Concurrent burst (50 tenants, Promise.all): p95 < P5_PERF_GATE_MS (default 100 target SLO).
 *    Local Postgres on 5434 with default Prisma pool typically exceeds 100ms under 50 concurrent TX;
 *    document measured values in HARDENED-GATE-REPORT.md. Set P5_PERF_GATE_MS to infra-proven
 *    ceiling or P5_PERF_GATE_SKIP=true only with report justification.
 */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { persistNewTourAtomically } from "../../src/canonical/atomic-canonical-tour-persist";
import {
  clearPreTransactionValidationGate,
  runPreTransactionValidation,
} from "../../src/canonical/pre-transaction-validation";
import { disconnectPrisma } from "../../src/db/prisma";
import { integrationTenantId } from "../test-helpers";
import { skipUnlessNightlyTier } from "../test-tier";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const perfSkip = process.env.P5_PERF_GATE_SKIP?.trim().toLowerCase() === "true";
const perfThresholdMs = Number.parseInt(process.env.P5_PERF_GATE_MS?.trim() ?? "100", 10);

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const CONCURRENCY = 50;
const SERIAL_BASELINE_OPS = 10;
const SERIAL_BASELINE_MS = Number.parseInt(
  process.env.P5_SERIAL_PERF_GATE_MS?.trim() ?? "100",
  10
);

function logPerfStats(label: string, stats: PerfStats): void {
  console.log(`[P5-PERF] ${label}: ${JSON.stringify(stats)}`);
}

function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedMs.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedMs.length) - 1)
  );
  return sortedMs[index] ?? 0;
}

export type PerfStats = {
  readonly count: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  readonly thresholdMs: number;
};

/**
 * P5 hardened gate — 50 concurrent atomic persists meet latency SLO.
 */
describe(
  "chaos atomic write performance (integration)",
  { skip: !hasDatabase || perfSkip, concurrency: false },
  () => {
    const runId = randomUUID().slice(0, 8);
    const tenantIds: string[] = [];
    let admin: PrismaClient;
    const priorStorage = process.env.STORAGE_DRIVER;
    const priorAbort = process.env.P5_ATOMIC_TX_TEST_ABORT;

    before(async () => {
      delete process.env.P5_ATOMIC_TX_TEST_ABORT;
      process.env.STORAGE_DRIVER = "prisma";
      await disconnectPrisma();
      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });

      for (let i = 0; i < CONCURRENCY; i += 1) {
        const tenantId = integrationTenantId();
        tenantIds.push(tenantId);
        await admin.tenant.create({
          data: {
            id: tenantId,
            subdomain: `perf-${runId}-${i}`,
            workspaceType: "starter",
            theme: {},
          },
        });
      }
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorage;
      process.env.P5_ATOMIC_TX_TEST_ABORT = priorAbort;
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        for (const tenantId of tenantIds) {
          await admin.auditEvent.deleteMany({ where: { tenantId } });
          await admin.outboxEvent.deleteMany({ where: { tenantId } });
          await admin.tour.deleteMany({ where: { tenantId } });
        }
        await admin.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
      await admin.$disconnect();
      await disconnectPrisma();
    });

    async function persistForTenant(
      tenantId: string,
      marker: string
    ): Promise<{ tenantId: string; id: string; latencyMs: number }> {
      const start = performance.now();
      try {
        const canonical = await runPreTransactionValidation({
          body: {
            data: {
              basics: { title: marker },
              details: { summary: "perf" },
            },
          },
          tenantId,
          workspaceType: "starter",
        });
        const result = await persistNewTourAtomically({ tenantId, canonical });
        return {
          tenantId: result.tenantId,
          id: result.id,
          latencyMs: performance.now() - start,
        };
      } finally {
        clearPreTransactionValidationGate();
      }
    }

    it(`serial baseline: 10 persists p95 under ${SERIAL_BASELINE_MS}ms after warmup`, async () => {
      const tenantId = tenantIds[0]!;
      await persistForTenant(tenantId, `perf-${runId}-warmup`);
      await admin.outboxEvent.deleteMany({ where: { tenantId } });
      await admin.tour.deleteMany({ where: { tenantId } });

      const latenciesMs: number[] = [];
      for (let i = 0; i < SERIAL_BASELINE_OPS; i += 1) {
        const result = await persistForTenant(tenantId, `perf-${runId}-serial-${i}`);
        latenciesMs.push(result.latencyMs);
      }

      const sorted = [...latenciesMs].sort((a, b) => a - b);
      const stats: PerfStats = {
        count: sorted.length,
        p50Ms: percentile(sorted, 50),
        p95Ms: percentile(sorted, 95),
        maxMs: sorted[sorted.length - 1] ?? 0,
        thresholdMs: SERIAL_BASELINE_MS,
      };
      logPerfStats("serial-baseline", stats);

      assert.ok(
        stats.p95Ms < SERIAL_BASELINE_MS,
        `serial p95 ${stats.p95Ms.toFixed(2)}ms must be < ${SERIAL_BASELINE_MS}ms`
      );
    });

    it(
      "P5 perf gate: 50 concurrent persists p95 under threshold",
      { skip: skipUnlessNightlyTier("50 concurrent atomic write perf gate") },
      async () => {
        const latenciesMs: number[] = [];

        const results = await Promise.all(
          tenantIds.map(async (tenantId, index) => {
            const result = await persistForTenant(tenantId, `perf-${runId}-${index}`);
            latenciesMs.push(result.latencyMs);
            return result;
          })
        );

        assert.equal(results.length, CONCURRENCY);

        const sorted = [...latenciesMs].sort((a, b) => a - b);
        const stats: PerfStats = {
          count: sorted.length,
          p50Ms: percentile(sorted, 50),
          p95Ms: percentile(sorted, 95),
          maxMs: sorted[sorted.length - 1] ?? 0,
          thresholdMs: perfThresholdMs,
        };

        logPerfStats("concurrent-50", stats);

        assert.ok(
          stats.p95Ms < perfThresholdMs,
          `p95 ${stats.p95Ms.toFixed(2)}ms must be < ${perfThresholdMs}ms (p50=${stats.p50Ms.toFixed(2)} max=${stats.maxMs.toFixed(2)})`
        );

        for (const result of results) {
          const outbox = await admin.outboxEvent.findMany({
            where: { tenantId: result.tenantId, aggregateId: result.id },
          });
          assert.equal(outbox.length, 1, "each successful persist must pair tour+outbox");
        }
      }
    );
  }
);

describe("chaos atomic write performance skip marker", { skip: !hasDatabase || !perfSkip }, () => {
  it("documents skip — run with P5_PERF_GATE_SKIP unset to enforce SLO", () => {
    assert.ok(true);
  });
});
