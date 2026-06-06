/**
 * 3-performance — pre-TX validation delay must not hold DB connections or locks.
 *
 * Architecture under test (RULE-003):
 *   runPreTransactionValidation (sync RuleEngine)
 *     → awaitPreTransactionValidationDelayForTests (P5_VALIDATE_DELAY_MS — async, no pool)
 *     → withCanonicalTransaction (connection acquired here only)
 *
 * While validation delay runs, pg_stat_activity for `app_tour` must show zero
 * `idle in transaction`; a concurrent pool probe must succeed on connection_limit=1.
 *
 * Requires Postgres (DATABASE_URL). Skipped when unset.
 *
 * Run:
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=prisma \
 *     DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=1&pool_timeout=2' \
 *     P5_VALIDATE_DELAY_MS=500 \
 *     node --import tsx --test test/3-performance/long-tx-safety.spec.ts
 *
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-013
 * @see apps/api/test/reliability/outbox-relay-connection-leak.spec.ts — pg_stat_activity sampling
 */
import assert from "node:assert/strict";
import http from "node:http";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../../src/app";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { ToursService } from "../../src/tours/tours.service";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const DEFAULT_VALIDATE_DELAY_MS = 500;
const POOL_CONNECTION_LIMIT = 1;
const POOL_TIMEOUT_SEC = 2;
const SAMPLE_INTERVAL_MS = 25;
const VALIDATION_SAMPLE_MARGIN_MS = 50;
const SUITE_TIMEOUT_MS = 30_000;
const CONCURRENT_PROBE_DEADLINE_MS = 2_000;

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_BASE =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

export type ConnectionSnapshot = {
  readonly total: number;
  readonly active: number;
  readonly idle: number;
  readonly idleInTransaction: number;
};

export type LongTxSafetyReport = {
  readonly verdict: "pass" | "fail";
  readonly validateDelayMs: number;
  readonly maxIdleInTransactionDuringValidation: number;
  readonly validationSampleCount: number;
  readonly concurrentProbeStatus: number;
  readonly concurrentProbeDurationMs: number;
  readonly createTourStatus: number;
  readonly createTourDurationMs: number;
  readonly connectionAcquiredDuring: "persist_only" | "validation_bug";
};

function upsertQueryParam(url: string, key: string, value: string): string {
  const re = new RegExp(`([?&])${key}=[^&]*`, "i");
  if (re.test(url)) {
    return url.replace(re, `$1${key}=${encodeURIComponent(value)}`);
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${key}=${encodeURIComponent(value)}`;
}

function withPoolTestUrl(url: string): string {
  const withLimit = upsertQueryParam(url, "connection_limit", String(POOL_CONNECTION_LIMIT));
  return upsertQueryParam(withLimit, "pool_timeout", String(POOL_TIMEOUT_SEC));
}

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "long-tx-safety-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-long-tx",
  };
}

async function countAppTourConnections(admin: PrismaClient): Promise<ConnectionSnapshot> {
  const rows = await admin.$queryRaw<Array<{ state: string | null; count: number }>>`
    SELECT state, count(*)::int AS count
    FROM pg_stat_activity
    WHERE usename = 'app_tour'
      AND datname = current_database()
    GROUP BY state
  `;

  let total = 0;
  let active = 0;
  let idle = 0;
  let idleInTransaction = 0;

  for (const row of rows) {
    total += row.count;
    const state = row.state ?? "unknown";
    if (state === "active") {
      active += row.count;
    } else if (state === "idle") {
      idle += row.count;
    } else if (state === "idle in transaction") {
      idleInTransaction += row.count;
    }
  }

  return { total, active, idle, idleInTransaction };
}

async function waitForConnectionDrain(
  admin: PrismaClient,
  maxAttempts = 20,
  delayMs = 50
): Promise<ConnectionSnapshot> {
  let snapshot = await countAppTourConnections(admin);
  for (let attempt = 0; attempt < maxAttempts && snapshot.idleInTransaction > 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    snapshot = await countAppTourConnections(admin);
  }
  return snapshot;
}

function validTourBody(title: string): {
  data: { basics: { title: string }; details: { summary: string } };
} {
  return {
    data: { basics: { title }, details: { summary: "long-tx-safety" } },
  };
}

describe(
  "long TX safety — validation delay does not hold connections (3-performance)",
  { skip: !hasDatabase, concurrency: false, timeout: SUITE_TIMEOUT_MS },
  () => {
    const runId = randomUUID().slice(0, 8);
    let tenantId: string;
    let admin: PrismaClient;
    let listener: ReturnType<typeof createRequestListener>;
    let server: http.Server;
    let port = 0;
    const priorStorageDriver = process.env.STORAGE_DRIVER;
    const priorValidateDelay = process.env.P5_VALIDATE_DELAY_MS;
    const priorDatabaseUrl = process.env.DATABASE_URL;
    let lastReport: LongTxSafetyReport | undefined;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.NODE_ENV = "test";
      process.env.DATABASE_URL_ADMIN = ADMIN_URL;
      process.env.P5_VALIDATE_DELAY_MS = String(
        Number.parseInt(
          process.env.P5_VALIDATE_DELAY_MS?.trim() ?? String(DEFAULT_VALIDATE_DELAY_MS),
          10
        ) || DEFAULT_VALIDATE_DELAY_MS
      );
      process.env.DATABASE_URL = withPoolTestUrl(process.env.DATABASE_URL?.trim() ?? APP_TOUR_BASE);
      await disconnectPrisma();
      admin = getPrismaAdmin();

      tenantId = integrationTenantId();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `long-tx-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });

      const toursService = new ToursService(
        new CanonicalTourService(
          new TourStorageDbAdapter(createTourStorageRepository()),
          new LegacyCanonicalAdapter()
        )
      );
      listener = createRequestListener({ toursService });
      server = http.createServer(listener);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        throw new Error("long-tx-safety: no listen address");
      }
      port = addr.port;
    });

    after(async () => {
      server.close();
      process.env.STORAGE_DRIVER = priorStorageDriver;
      process.env.P5_VALIDATE_DELAY_MS = priorValidateDelay;
      process.env.DATABASE_URL = priorDatabaseUrl;

      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        await admin.auditEvent.deleteMany({ where: { tenantId } });
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.tour.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
      await disconnectPrisma();
    });

    async function httpRequest(
      path: string,
      method: "GET" | "POST",
      body?: unknown
    ): Promise<{ status: number; durationMs: number; body: Record<string, unknown> }> {
      const start = performance.now();
      return new Promise((resolve, reject) => {
        const payload = body === undefined ? undefined : JSON.stringify(body);
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path,
            method,
            headers: {
              ...(payload
                ? {
                    "Content-Type": "application/json",
                    "Content-Length": String(Buffer.byteLength(payload)),
                  }
                : {}),
              ...authHeaders(tenantId),
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
              const durationMs = performance.now() - start;
              const raw = Buffer.concat(chunks).toString("utf8");
              let parsed: Record<string, unknown> = {};
              if (raw.length > 0) {
                try {
                  parsed = JSON.parse(raw) as Record<string, unknown>;
                } catch {
                  parsed = { error: "invalid_json" };
                }
              }
              resolve({ status: res.statusCode ?? 0, durationMs, body: parsed });
            });
          }
        );
        req.on("error", reject);
        req.setTimeout(SUITE_TIMEOUT_MS, () => {
          req.destroy(new Error("client_timeout"));
        });
        if (payload) {
          req.write(payload);
        }
        req.end();
      });
    }

    it("no idle-in-TX above baseline during validation delay window", async () => {
      const validateDelayMs = Number.parseInt(
        process.env.P5_VALIDATE_DELAY_MS ?? String(DEFAULT_VALIDATE_DELAY_MS),
        10
      );
      const samplingStartMs = VALIDATION_SAMPLE_MARGIN_MS;
      const samplingEndMs = validateDelayMs - VALIDATION_SAMPLE_MARGIN_MS;

      await waitForConnectionDrain(admin);
      const baseline = await countAppTourConnections(admin);

      let maxIdleDeltaDuringValidation = 0;
      let validationSampleCount = 0;

      const createStart = performance.now();
      const createPromise = httpRequest("/tours", "POST", validTourBody(`long-tx-${runId}-a`));

      await new Promise((resolve) => setTimeout(resolve, samplingStartMs));

      const sampleUntil = createStart + samplingEndMs;
      while (performance.now() < sampleUntil) {
        const snapshot = await countAppTourConnections(admin);
        validationSampleCount += 1;
        const delta = snapshot.idleInTransaction - baseline.idleInTransaction;
        if (delta > maxIdleDeltaDuringValidation) {
          maxIdleDeltaDuringValidation = delta;
        }
        await new Promise((resolve) => setTimeout(resolve, SAMPLE_INTERVAL_MS));
      }

      const createResult = await createPromise;
      const createDurationMs = performance.now() - createStart;

      const connectionAcquiredDuring =
        maxIdleDeltaDuringValidation > 0 ? "validation_bug" : "persist_only";

      lastReport = {
        verdict:
          maxIdleDeltaDuringValidation === 0 && createResult.status === 201 ? "pass" : "fail",
        validateDelayMs,
        maxIdleInTransactionDuringValidation: maxIdleDeltaDuringValidation,
        validationSampleCount,
        concurrentProbeStatus: 0,
        concurrentProbeDurationMs: 0,
        createTourStatus: createResult.status,
        createTourDurationMs: createDurationMs,
        connectionAcquiredDuring,
      };

      if (process.env.LONG_TX_SAFETY_EMIT === "1") {
        console.info(JSON.stringify(lastReport, null, 2));
      }

      assert.equal(
        maxIdleDeltaDuringValidation,
        0,
        [
          "idle in transaction grew during validation delay — TX opened before persist (architecture bug)",
          `  baseline=${baseline.idleInTransaction} maxDelta=${maxIdleDeltaDuringValidation}`,
          `  validateDelayMs=${validateDelayMs} samples=${validationSampleCount}`,
          `  sampleWindowMs=${samplingStartMs}-${samplingEndMs}`,
          `  connectionAcquiredDuring=${connectionAcquiredDuring}`,
        ].join("\n")
      );

      assert.equal(
        createResult.status,
        201,
        `create tour failed: ${JSON.stringify(createResult.body)}`
      );
      assert.ok(
        createDurationMs >= validateDelayMs * 0.85,
        `create tour finished too fast (${createDurationMs.toFixed(1)}ms) — validation delay hook may be inactive`
      );
    });

    it("concurrent pool probe succeeds during validation delay", async () => {
      const validateDelayMs = Number.parseInt(
        process.env.P5_VALIDATE_DELAY_MS ?? String(DEFAULT_VALIDATE_DELAY_MS),
        10
      );

      await waitForConnectionDrain(admin);

      const createPromise = httpRequest("/tours", "POST", validTourBody(`long-tx-${runId}-b`));

      await new Promise((resolve) => setTimeout(resolve, VALIDATION_SAMPLE_MARGIN_MS));

      const probeStart = performance.now();
      const probe = await httpRequest("/internal/test/db-pool-hold", "GET");
      const probeDurationMs = performance.now() - probeStart;

      const createResult = await createPromise;

      if (lastReport) {
        lastReport = {
          ...lastReport,
          concurrentProbeStatus: probe.status,
          concurrentProbeDurationMs: probeDurationMs,
          verdict:
            lastReport.verdict === "pass" && probe.status === 200 && createResult.status === 201
              ? "pass"
              : "fail",
        };
      }

      assert.equal(
        probe.status,
        200,
        [
          "concurrent pool probe failed — validation delay appears to hold the sole pool connection",
          `  status=${probe.status} durationMs=${probeDurationMs.toFixed(1)}`,
          `  pool_limit=${POOL_CONNECTION_LIMIT} pool_timeout=${POOL_TIMEOUT_SEC}s`,
        ].join("\n")
      );
      assert.ok(
        probeDurationMs < CONCURRENT_PROBE_DEADLINE_MS,
        `pool probe too slow (${probeDurationMs.toFixed(1)}ms) — likely blocked by validation-held connection`
      );
      assert.equal(
        createResult.status,
        201,
        `create tour failed: ${JSON.stringify(createResult.body)}`
      );
      assert.ok(
        createResult.durationMs >= validateDelayMs * 0.85,
        `create tour finished too fast (${createResult.durationMs.toFixed(1)}ms) — validation delay hook may be inactive`
      );
    });
  }
);
