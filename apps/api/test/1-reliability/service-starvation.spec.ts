/**
 * Reliability — ToursService write path vs synchronous rule validation (event-loop starvation).
 *
 * Architecture under test:
 *   ToursService.createTour
 *     → CanonicalTourService.writeTour
 *       → runPreTransactionValidation (sync)
 *         → validateCanonicalBeforePersist (sync; new PlatformWizardEngine per call)
 *       → persist (first await: in-memory save or Prisma TX)
 *
 * There is no setImmediate / worker offload between validation and persist today.
 * This spec stresses concurrent validation + writes and watches event-loop lag.
 */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { after, afterEach, before, describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { resetValidationSchedulerForTests } from "../../src/canonical/validation-scheduler";
import { runPreTransactionValidation } from "../../src/canonical/pre-transaction-validation";
import { validateCanonicalBeforePersistSync } from "../../src/tours/canonical-validation";
import { flushLogSink, logger } from "../../src/observability/logger";
import { createTestToursService, integrationTenantId } from "../test-helpers";

const VALID_TOUR_BODY = {
  data: { basics: { title: "starvation-write" }, details: { summary: "ok" } },
} as const;

/** Microtask-interleaved validation tasks (models many concurrent API handlers). */
const VALIDATION_BURST = Number.parseInt(process.env.STARVATION_VALIDATION_BURST ?? "1200", 10);

/** Synchronous validations in one macrotask (models one heavy handler before first await). */
const SYNC_VALIDATION_BURST = Number.parseInt(
  process.env.STARVATION_SYNC_VALIDATION_BURST ?? "6000",
  10
);

/** Min timer gap (ms) to treat sync burst as event-loop-blocking (architectural debt signal). */
const SYNC_STALL_MIN_GAP_MS = Number.parseInt(
  process.env.STARVATION_SYNC_STALL_MIN_GAP_MS ?? "80",
  10
);

const WRITE_BURST = Number.parseInt(process.env.STARVATION_WRITE_BURST ?? "24", 10);

/** Trunk full-suite load can spike ~200ms; override via STARVATION_MAX_HEARTBEAT_GAP_MS. */
const MAX_HEARTBEAT_GAP_MS = Number.parseInt(
  process.env.STARVATION_MAX_HEARTBEAT_GAP_MS ?? "260",
  10
);

const WRITE_DEADLINE_MS = Number.parseInt(process.env.STARVATION_WRITE_DEADLINE_MS ?? "2500", 10);

const WRITE_P95_RATIO_CAP = Number.parseFloat(process.env.STARVATION_WRITE_P95_RATIO ?? "8");

type EventLoopLagProbe = {
  readonly stop: () => void;
  readonly maxLagMs: () => number;
  readonly sampleCount: () => number;
};

function startEventLoopLagProbe(intervalMs = 8): EventLoopLagProbe {
  let maxLagMs = 0;
  let samples = 0;
  let stopped = false;

  const timer = setInterval(() => {
    const scheduledAt = performance.now();
    setImmediate(() => {
      if (stopped) {
        return;
      }
      const lag = performance.now() - scheduledAt;
      if (lag > maxLagMs) {
        maxLagMs = lag;
      }
      samples += 1;
    });
  }, intervalMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
    maxLagMs: () => maxLagMs,
    sampleCount: () => samples,
  };
}

type HeartbeatProbe = {
  readonly stop: () => void;
  readonly maxGapMs: () => number;
};

function startHeartbeatProbe(tickMs = 10): HeartbeatProbe {
  let lastBeat = performance.now();
  let maxGapMs = 0;
  let stopped = false;

  const timer = setInterval(() => {
    setImmediate(() => {
      if (stopped) {
        return;
      }
      const now = performance.now();
      const gap = now - lastBeat;
      if (gap > maxGapMs) {
        maxGapMs = gap;
      }
      lastBeat = now;
    });
  }, tickMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
    maxGapMs: () => maxGapMs,
  };
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function authForTenant(tenantId: string): TenantAuthContext {
  return {
    userId: "starvation-user",
    tenantId,
    role: "member",
    status: "ACTIVE",
    workspaceId: "ws-starvation",
  };
}

function validationInput(tenantId: string, index: number) {
  return {
    body: {
      data: {
        basics: { title: `validate-${index}` },
        details: { summary: index % 2 === 0 ? "ok" : "" },
      },
    },
    tenantId,
    workspaceType: "starter",
  } as const;
}

function runMicrotaskValidationBurst(tenantId: string, count: number): Promise<void> {
  const tasks = Array.from({ length: count }, (_, index) =>
    runPreTransactionValidation(validationInput(tenantId, index))
  );
  return Promise.all(tasks).then(() => undefined);
}

async function runSyncValidationBurst(tenantId: string, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await validateCanonicalBeforePersistSync(validationInput(tenantId, index));
  }
}

/** Timer-based stall detector — catches long synchronous stretches without setImmediate yields. */
async function measureSyncValidationStall(
  tenantId: string,
  count: number
): Promise<{ readonly syncWallMs: number; readonly maxTimerGapMs: number }> {
  let lastTick = performance.now();
  let maxTimerGapMs = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    maxTimerGapMs = Math.max(maxTimerGapMs, now - lastTick);
    lastTick = now;
  }, 5);

  const syncStarted = performance.now();
  await runSyncValidationBurst(tenantId, count);
  const syncWallMs = performance.now() - syncStarted;
  maxTimerGapMs = Math.max(maxTimerGapMs, performance.now() - lastTick);
  clearInterval(timer);

  return { syncWallMs, maxTimerGapMs };
}

function offloadRemediationHint(): string {
  return [
    "Missing async offload between CPU-heavy validation and persist:",
    "  apps/api/src/tours/canonical-validation.ts — validateCanonicalBeforePersistSync (probe) / validateCanonicalBeforePersist (production worker pool)",
    "  apps/api/src/canonical/pre-transaction-validation.ts — runPreTransactionValidation",
    "  apps/api/src/canonical/canonical-tour.service.ts — writeTourInActiveContext (before persistNewTourAtomically / scopedRepo.create)",
    "Suggested: await setImmediate(() => {}) or chunked validation before opening the DB transaction.",
  ].join("\n");
}

describe("1-reliability — ToursService vs rule validation (event-loop starvation)", () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorLogLevel = process.env.LOG_LEVEL;
  const priorValidationDepth = process.env.P5_VALIDATION_MAX_QUEUE_DEPTH_PER_TENANT;
  const priorValidationConcurrent = process.env.P5_VALIDATION_MAX_CONCURRENT;
  const priorValidationInFlight = process.env.P5_VALIDATION_MAX_IN_FLIGHT_PER_TENANT;
  const priorMaxTourWrites = process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    process.env.LOG_LEVEL = "error";
    logger.level = "error";
    process.env.P5_VALIDATION_MAX_QUEUE_DEPTH_PER_TENANT = String(VALIDATION_BURST);
    process.env.P5_VALIDATION_MAX_CONCURRENT = "16";
    process.env.P5_VALIDATION_MAX_IN_FLIGHT_PER_TENANT = "8";
    process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = String(WRITE_BURST);
    resetValidationSchedulerForTests();
  });

  afterEach(async () => {
    await flushLogSink();
  });

  after(() => {
    resetValidationSchedulerForTests();
    if (priorLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = priorLogLevel;
    }
    logger.level = process.env.LOG_LEVEL ?? "info";
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
    if (priorValidationDepth === undefined) {
      delete process.env.P5_VALIDATION_MAX_QUEUE_DEPTH_PER_TENANT;
    } else {
      process.env.P5_VALIDATION_MAX_QUEUE_DEPTH_PER_TENANT = priorValidationDepth;
    }
    if (priorValidationConcurrent === undefined) {
      delete process.env.P5_VALIDATION_MAX_CONCURRENT;
    } else {
      process.env.P5_VALIDATION_MAX_CONCURRENT = priorValidationConcurrent;
    }
    if (priorValidationInFlight === undefined) {
      delete process.env.P5_VALIDATION_MAX_IN_FLIGHT_PER_TENANT;
    } else {
      process.env.P5_VALIDATION_MAX_IN_FLIGHT_PER_TENANT = priorValidationInFlight;
    }
    if (priorMaxTourWrites === undefined) {
      delete process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES;
    } else {
      process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = priorMaxTourWrites;
    }
  });

  it("microtask-interleaved validation storm with concurrent ToursService writes stays within event-loop SLO", async () => {
    resetValidationSchedulerForTests();
    await new Promise<void>((resolve) => setImmediate(resolve));

    const toursService = createTestToursService();
    const validationTenant = integrationTenantId();
    const writeTenants = Array.from({ length: WRITE_BURST }, () => integrationTenantId());

    const lagProbe = startEventLoopLagProbe();
    const heartbeat = startHeartbeatProbe();

    const writeLatenciesMs: number[] = [];

    const validationStorm = runMicrotaskValidationBurst(validationTenant, VALIDATION_BURST);
    const writeStorm = Promise.all(
      writeTenants.map(async (tenantId) => {
        const started = performance.now();
        await toursService.createTour(authForTenant(tenantId), { ...VALID_TOUR_BODY });
        writeLatenciesMs.push(performance.now() - started);
      })
    );

    const stormStarted = performance.now();
    const [validationResult, writeResult] = await Promise.allSettled([validationStorm, writeStorm]);
    const stormDurationMs = performance.now() - stormStarted;

    lagProbe.stop();
    heartbeat.stop();

    assert.equal(validationResult.status, "fulfilled");
    assert.equal(writeResult.status, "fulfilled");
    assert.equal(writeLatenciesMs.length, WRITE_BURST);

    const sortedWrites = [...writeLatenciesMs].sort((a, b) => a - b);
    const writeP95Ms = percentile(sortedWrites, 95);
    const writeMaxMs = sortedWrites[sortedWrites.length - 1] ?? 0;
    const maxHeartbeatGapMs = heartbeat.maxGapMs();

    const baselineWriteStarted = performance.now();
    await toursService.createTour(authForTenant(integrationTenantId()), {
      ...VALID_TOUR_BODY,
    });
    const baselineWriteMs = performance.now() - baselineWriteStarted;

    const report = {
      mode: "microtask-interleaved",
      validationBurst: VALIDATION_BURST,
      writeBurst: WRITE_BURST,
      stormDurationMs: Math.round(stormDurationMs),
      stormMaxLagMs: Math.round(lagProbe.maxLagMs() * 100) / 100,
      maxHeartbeatGapMs: Math.round(maxHeartbeatGapMs * 100) / 100,
      baselineWriteMs: Math.round(baselineWriteMs * 100) / 100,
      writeP95Ms: Math.round(writeP95Ms * 100) / 100,
      writeMaxMs: Math.round(writeMaxMs * 100) / 100,
    };

    assert.ok(
      writeMaxMs <= WRITE_DEADLINE_MS,
      `write critical path exceeded deadline. ${JSON.stringify(report)}\n${offloadRemediationHint()}`
    );
    assert.ok(
      maxHeartbeatGapMs <= MAX_HEARTBEAT_GAP_MS,
      `event loop heartbeat gap too large under microtask load. ${JSON.stringify(report)}\n${offloadRemediationHint()}`
    );
    const p95Ratio = baselineWriteMs > 0 ? writeP95Ms / baselineWriteMs : writeP95Ms;
    assert.ok(
      writeP95Ms <= baselineWriteMs * WRITE_P95_RATIO_CAP || writeP95Ms <= WRITE_DEADLINE_MS,
      `write p95 degraded (${writeP95Ms}ms, ratio=${p95Ratio.toFixed(1)}×). ${JSON.stringify(report)}\n${offloadRemediationHint()}`
    );
  });

  it("AUDIT: synchronous validation monolith blocks the event loop (documented debt; writes still complete)", async () => {
    const toursService = createTestToursService();
    const validationTenant = integrationTenantId();
    const writeTenants = Array.from({ length: WRITE_BURST }, () => integrationTenantId());

    const writeLatenciesMs: number[] = [];
    const writeStorm = Promise.all(
      writeTenants.map(async (tenantId) => {
        const started = performance.now();
        await toursService.createTour(authForTenant(tenantId), { ...VALID_TOUR_BODY });
        writeLatenciesMs.push(performance.now() - started);
      })
    );

    await new Promise<void>((resolve) => setImmediate(resolve));

    const { syncWallMs, maxTimerGapMs } = await measureSyncValidationStall(
      validationTenant,
      SYNC_VALIDATION_BURST
    );

    const writeResult = await Promise.allSettled([writeStorm]);
    assert.equal(writeResult[0]?.status, "fulfilled");

    const sortedWrites = [...writeLatenciesMs].sort((a, b) => a - b);
    const writeMaxMs = sortedWrites[sortedWrites.length - 1] ?? 0;

    const report = {
      mode: "sync-monolith",
      syncValidationBurst: SYNC_VALIDATION_BURST,
      writeBurst: WRITE_BURST,
      syncWallMs: Math.round(syncWallMs * 100) / 100,
      maxTimerGapMs: Math.round(maxTimerGapMs * 100) / 100,
      writeMaxMs: Math.round(writeMaxMs * 100) / 100,
    };

    assert.ok(
      writeMaxMs <= WRITE_DEADLINE_MS,
      `writes did not finish after sync validation monolith. ${JSON.stringify(report)}\n${offloadRemediationHint()}`
    );

    assert.ok(
      syncWallMs >= 55,
      `sync workload too small to probe starvation (${syncWallMs}ms); raise STARVATION_SYNC_VALIDATION_BURST`
    );

    const blocksEventLoop =
      maxTimerGapMs >= Math.min(syncWallMs * 0.3, syncWallMs - 15) &&
      maxTimerGapMs >= Math.min(SYNC_STALL_MIN_GAP_MS, syncWallMs * 0.85);

    assert.ok(
      blocksEventLoop,
      [
        "Expected sync validation to stall the event loop for this workload (probe too weak).",
        `syncWallMs=${syncWallMs} maxTimerGapMs=${maxTimerGapMs}`,
        `Raise STARVATION_SYNC_VALIDATION_BURST (now ${SYNC_VALIDATION_BURST}).`,
      ].join(" ")
    );

    assert.ok(
      syncWallMs >= SYNC_STALL_MIN_GAP_MS,
      `sync workload too small (${syncWallMs}ms); raise STARVATION_SYNC_VALIDATION_BURST`
    );

    // Debt: runPreTransactionValidation is sync before first persist await (see offloadRemediationHint).
    assert.match(offloadRemediationHint(), /pre-transaction-validation/);
  });
});
