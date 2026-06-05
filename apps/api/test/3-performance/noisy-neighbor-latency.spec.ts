/**
 * 3-performance — noisy-neighbor CPU / rule-validation latency probe.
 *
 * Scenario:
 *   - Tenant A (heavy): VALIDATION_BURST synchronous plugin validations
 *     (`validateCanonicalBeforePersist` — new PlatformWizardEngine per call; no pre-TX gate)
 *   - Tenant B (quiet): 1 simple `ToursService.createTour`
 *   - Both run concurrently (A noise while B creates)
 *
 * SLO: Tenant B under-load latency must stay within **10%** of measured baseline
 * (`ratio ≤ BASELINE_RATIO_MAX`, default 1.10). Failure encodes missing per-tenant
 * **Resource Quota / Request Throttling** — Node's single-thread event loop cannot
 * isolate CPU-heavy validation from victim writes without explicit throttling or offload.
 *
 * Unlike `2-observability/noise-neighbor.spec.ts` (500 DB reads, 300% SLO), this probes
 * CPU / rule-engine fairness, not connection-pool contention.
 *
 * Env tunables:
 *   VALIDATION_BURST          — tenant-A validation tasks (default 1000)
 *   BASELINE_RATIO_MAX        — fail when under-load / baseline exceeds this (default 1.10)
 *   BASELINE_WRITE_SAMPLES    — solo B writes before probe (default 10)
 *   BASELINE_MS_OVERRIDE      — optional fixed baseline (ms)
 *   STORAGE_DRIVER            — `memory` (default) or `prisma` (requires DATABASE_URL)
 *   NOISY_NEIGHBOR_LATENCY_EMIT — set "1" to log JSON report to stdout
 *   NOISY_NEIGHBOR_HEARTBEAT  — set "0" to disable event-loop heartbeat probe
 *
 * Run (memory — no Postgres):
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/3-performance/noisy-neighbor-latency.spec.ts
 *
 * Run (Postgres integration):
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=prisma DATABASE_URL=... node --import tsx --test test/3-performance/noisy-neighbor-latency.spec.ts
 *
 * @see apps/api/test/2-observability/noise-neighbor.spec.ts — read-noise observability probe
 * @see apps/api/test/1-reliability/service-starvation.spec.ts — event-loop starvation patterns
 */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import { PrismaClient } from "@prisma/client";

import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { runScheduledValidation } from "../../src/canonical/validation-scheduler";
import {
  validateCanonicalBeforePersist,
  type ValidateBeforePersistInput,
} from "../../src/tours/canonical-validation";
import { ToursService } from "../../src/tours/tours.service";
import { createTestToursService, integrationTenantId } from "../test-helpers";
import { skipUnlessNightlyTier } from "../test-tier";

const VALIDATION_BURST = Number.parseInt(process.env.VALIDATION_BURST ?? "1000", 10);
const BASELINE_RATIO_MAX = Number.parseFloat(process.env.BASELINE_RATIO_MAX ?? "1.10");
const BASELINE_WRITE_SAMPLES = Number.parseInt(process.env.BASELINE_WRITE_SAMPLES ?? "10", 10);
const BASELINE_MS_OVERRIDE = process.env.BASELINE_MS_OVERRIDE?.trim()
  ? Number(process.env.BASELINE_MS_OVERRIDE)
  : undefined;
const HEARTBEAT_ENABLED = process.env.NOISY_NEIGHBOR_HEARTBEAT !== "0";

const VALID_TOUR_BODY = {
  data: { basics: { title: "noisy-neighbor-b" }, details: { summary: "ok" } },
} as const;

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const requestedDriver = process.env.STORAGE_DRIVER?.trim().toLowerCase();
const usePostgres = requestedDriver === "prisma" || (requestedDriver !== "memory" && hasDatabase);

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

export type NoisyNeighborLatencyReport = {
  readonly verdict: "pass" | "throttling_gap";
  readonly storageDriver: "memory" | "prisma";
  readonly baselineMs: number;
  readonly baselineSource: "measured" | "env_override";
  readonly underLoadMs: number;
  readonly ratio: number;
  readonly baselineRatioMax: number;
  readonly validationBurst: number;
  readonly validationsCompleted: number;
  readonly writeSucceeded: boolean;
  readonly maxHeartbeatGapMs: number | null;
  readonly sreNote: string;
};

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function authForTenant(tenantId: string): TenantAuthContext {
  return {
    userId: "noisy-neighbor-user",
    tenantId,
    role: "member",
    status: "ACTIVE",
    workspaceId: "ws-noisy-neighbor",
  };
}

/** Heavy validation input — varied title/summary to exercise plugin rules per call. */
function heavyValidationInput(tenantId: string, index: number): ValidateBeforePersistInput {
  return {
    body: {
      schemaVersion: 1,
      roots: ["basics", "details"],
      data: {
        basics: { title: `heavy-a-${index}-${"v".repeat(24)}` },
        details: {
          summary: `dim-${index % 11}-payload-${index}-${"w".repeat(index % 16)}`,
        },
      },
    },
    tenantId,
    workspaceType: "starter",
  };
}

const STORM_BATCH_SIZE = Number.parseInt(process.env.VALIDATION_STORM_BATCH_SIZE ?? "8", 10);

/**
 * Validation storm through DEC-016 scheduler — batched with event-loop yields so victim
 * tenant writes can interleave (models many HTTP handlers, not one sync monolith).
 */
async function runValidationStorm(tenantId: string, count: number): Promise<number> {
  const batchSize = Math.max(1, STORM_BATCH_SIZE);
  for (let offset = 0; offset < count; offset += batchSize) {
    const slice = Math.min(batchSize, count - offset);
    await Promise.all(
      Array.from({ length: slice }, (_, index) =>
        runScheduledValidation(tenantId, () =>
          validateCanonicalBeforePersist(heavyValidationInput(tenantId, offset + index))
        )
      )
    );
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
  return count;
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

function throttlingGapMessage(report: NoisyNeighborLatencyReport): string {
  return [
    "NOISY_NEIGHBOR_LATENCY_THROTTLING_GAP: tenant B createTour exceeded 10% baseline under tenant A validation storm",
    `  storage: ${report.storageDriver}`,
    `  baseline: ${report.baselineMs.toFixed(2)}ms (${report.baselineSource}, p50 of ${BASELINE_WRITE_SAMPLES} solo writes)`,
    `  under load: ${report.underLoadMs.toFixed(2)}ms`,
    `  ratio: ${report.ratio.toFixed(2)}× (SLO ≤ ${report.baselineRatioMax}× = +${Math.round((report.baselineRatioMax - 1) * 100)}% over baseline)`,
    `  noise: ${report.validationBurst} microtask-interleaved validateCanonicalBeforePersist on tenant A`,
    report.maxHeartbeatGapMs !== null
      ? `  max event-loop heartbeat gap: ${report.maxHeartbeatGapMs.toFixed(2)}ms`
      : undefined,
    "  hypothesis: Node single-thread + sync validation monolith — tenant A steals >90% effective CPU",
    "  remediation: per-tenant request throttling, validation worker pool, or chunked async offload",
    "  data isolation may remain intact; this is a resource-fairness performance signal",
  ]
    .filter(Boolean)
    .join("\n");
}

const tierSkip = skipUnlessNightlyTier("noisy-neighbor-latency");
const dbSkip =
  usePostgres && !hasDatabase ? "DATABASE_URL required for prisma noisy-neighbor probe" : false;
const suiteSkip = tierSkip !== false ? tierSkip : dbSkip;

describe(
  "noisy-neighbor validation latency (3-performance)",
  { skip: suiteSkip, concurrency: false },
  () => {
    const runId = randomUUID().slice(0, 8);
    let tenantAId: string;
    let tenantBId: string;
    let toursService: ToursService;
    let admin: PrismaClient | undefined;
    const priorStorageDriver = process.env.STORAGE_DRIVER;
    let lastReport: NoisyNeighborLatencyReport | undefined;

    before(async () => {
      tenantAId = integrationTenantId();
      tenantBId = integrationTenantId();

      if (usePostgres) {
        process.env.STORAGE_DRIVER = "prisma";
        await disconnectPrisma();
        admin = getPrismaAdmin();
        await admin.tenant.create({
          data: {
            id: tenantAId,
            subdomain: `nn-a-${runId}`,
            workspaceType: "starter",
            theme: {},
          },
        });
        await admin.tenant.create({
          data: {
            id: tenantBId,
            subdomain: `nn-b-${runId}`,
            workspaceType: "starter",
            theme: {},
          },
        });
        toursService = new ToursService(
          new CanonicalTourService(
            new TourStorageDbAdapter(createTourStorageRepository()),
            new LegacyCanonicalAdapter()
          )
        );
      } else {
        process.env.STORAGE_DRIVER = "memory";
        toursService = createTestToursService();
      }
    });

    after(async () => {
      if (priorStorageDriver === undefined) {
        delete process.env.STORAGE_DRIVER;
      } else {
        process.env.STORAGE_DRIVER = priorStorageDriver;
      }

      if (admin) {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
        );
        try {
          for (const tenantId of [tenantAId, tenantBId]) {
            await admin.auditEvent.deleteMany({ where: { tenantId } });
            await admin.outboxEvent.deleteMany({ where: { tenantId } });
            await admin.tour.deleteMany({ where: { tenantId } });
            await admin.tenant.delete({ where: { id: tenantId } });
          }
        } finally {
          await admin.$executeRawUnsafe(
            `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
          );
        }
        await disconnectPrisma();
      }
    });

    async function createTourB(suffix: string): Promise<{ durationMs: number }> {
      const started = performance.now();
      await toursService.createTour(authForTenant(tenantBId), {
        ...VALID_TOUR_BODY,
        data: {
          basics: { title: `nn-b-${runId}-${suffix}` },
          details: { summary: "write" },
        },
      });
      return { durationMs: performance.now() - started };
    }

    it("NOISY-NEIGHBOR-LATENCY: tenant-A validation storm must not push tenant-B createTour beyond baseline × 1.10", async () => {
      const baselineSamples: number[] = [];
      for (let i = 0; i < BASELINE_WRITE_SAMPLES; i += 1) {
        const sample = await createTourB(`baseline-${i}`);
        baselineSamples.push(sample.durationMs);
      }

      const baselineSorted = [...baselineSamples].sort((a, b) => a - b);
      const measuredBaselineMs = percentile(baselineSorted, 50);
      const baselineMs =
        BASELINE_MS_OVERRIDE !== undefined && !Number.isNaN(BASELINE_MS_OVERRIDE)
          ? BASELINE_MS_OVERRIDE
          : measuredBaselineMs;
      const baselineSource =
        BASELINE_MS_OVERRIDE !== undefined && !Number.isNaN(BASELINE_MS_OVERRIDE)
          ? ("env_override" as const)
          : ("measured" as const);

      const sloCeilingMs = baselineMs * BASELINE_RATIO_MAX;

      const heartbeat = HEARTBEAT_ENABLED ? startHeartbeatProbe() : undefined;

      let underLoadMs = 0;
      let writeSucceeded = false;
      let validationsCompleted = 0;

      const writePromise = (async () => {
        const sample = await createTourB("under-load");
        underLoadMs = sample.durationMs;
        writeSucceeded = true;
      })();

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      const validationPromise = runValidationStorm(tenantAId, VALIDATION_BURST);

      const [validationResult, writeResult] = await Promise.allSettled([
        validationPromise,
        writePromise,
      ]);

      heartbeat?.stop();
      const maxHeartbeatGapMs = heartbeat ? heartbeat.maxGapMs() : null;

      assert.equal(
        validationResult.status,
        "fulfilled",
        `tenant A validation storm must complete (${VALIDATION_BURST} tasks)`
      );
      if (validationResult.status === "fulfilled") {
        validationsCompleted = validationResult.value;
      }

      assert.equal(
        writeResult.status,
        "fulfilled",
        writeResult.status === "rejected"
          ? `tenant B write under load must succeed: ${String(writeResult.reason)}`
          : "tenant B write under load must succeed"
      );

      const ratio = baselineMs > 0 ? underLoadMs / baselineMs : underLoadMs;
      const withinSlo = underLoadMs <= sloCeilingMs;
      const verdict: NoisyNeighborLatencyReport["verdict"] = withinSlo ? "pass" : "throttling_gap";

      lastReport = {
        verdict,
        storageDriver: usePostgres ? "prisma" : "memory",
        baselineMs: Math.round(baselineMs * 100) / 100,
        baselineSource,
        underLoadMs: Math.round(underLoadMs * 100) / 100,
        ratio: Math.round(ratio * 100) / 100,
        baselineRatioMax: BASELINE_RATIO_MAX,
        validationBurst: VALIDATION_BURST,
        validationsCompleted,
        writeSucceeded,
        maxHeartbeatGapMs:
          maxHeartbeatGapMs !== null ? Math.round(maxHeartbeatGapMs * 100) / 100 : null,
        sreNote:
          verdict === "pass"
            ? "Per-tenant CPU fairness within 10% SLO under validation noise"
            : "Missing resource quota / request throttling — noisy neighbor degrades victim latency",
      };

      process.env.NOISY_NEIGHBOR_LATENCY_REPORT = JSON.stringify(lastReport);

      const summary = [
        `NOISY_NEIGHBOR_LATENCY verdict=${verdict} driver=${lastReport.storageDriver}`,
        `  baseline=${lastReport.baselineMs}ms under_load=${lastReport.underLoadMs}ms ratio=${lastReport.ratio}x (max=${BASELINE_RATIO_MAX}x)`,
        `  validation_burst=${VALIDATION_BURST} completed=${validationsCompleted}`,
        maxHeartbeatGapMs !== null
          ? `  max_heartbeat_gap=${lastReport.maxHeartbeatGapMs}ms`
          : undefined,
      ]
        .filter(Boolean)
        .join("\n");
      console.info(summary);

      if (process.env.NOISY_NEIGHBOR_LATENCY_EMIT === "1") {
        console.log(`NOISY_NEIGHBOR_LATENCY_JSON ${JSON.stringify(lastReport)}`);
      }

      if (!withinSlo) {
        assert.fail(throttlingGapMessage(lastReport));
      }
    });

    it("exposes NOISY_NEIGHBOR_LATENCY_REPORT for SRE audit", () => {
      assert.ok(lastReport, "noisy-neighbor latency report must be set by prior test");
      assert.ok(lastReport.writeSucceeded, "victim write must complete despite validation noise");
      assert.ok(
        lastReport.verdict === "pass" || lastReport.verdict === "throttling_gap",
        "verdict must be pass or throttling_gap"
      );

      const sreVerdict =
        lastReport.verdict === "pass"
          ? `NOISY_NEIGHBOR_SRE_VERDICT pass ratio=${lastReport.ratio}x baseline=${lastReport.baselineMs}ms under_load=${lastReport.underLoadMs}ms`
          : `NOISY_NEIGHBOR_SRE_VERDICT throttling_gap ratio=${lastReport.ratio}x baseline=${lastReport.baselineMs}ms under_load=${lastReport.underLoadMs}ms — implement per-tenant throttling`;

      console.info(sreVerdict);
    });
  }
);
