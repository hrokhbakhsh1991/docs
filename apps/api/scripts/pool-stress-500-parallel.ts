#!/usr/bin/env node
/**
 * Phase 3 scalability — ~500 parallel Prisma pool holds via HTTP probe.
 *
 * Extends db-pool-saturation.spec.ts (100 concurrent) to stress queue depth at 5× gate load.
 * Records every 503, transport error, timeout, and pg_stat_activity snapshot.
 *
 * Run:
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=prisma \
 *     DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=10&pool_timeout=1' \
 *     DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db' \
 *     P5_DB_HOLD_MS=250 \
 *     npx tsx scripts/pool-stress-500-parallel.ts
 *
 * Exit 0 = pass (503 storm, no hang, connections return to baseline).
 * Exit 1 = hung storm, unexpected statuses, or connection leak after cooldown.
 *
 * @see apps/api/docs/phase3-scalability-stress-audit.md
 * @see apps/api/test/3-performance/db-pool-saturation.spec.ts
 */
import http from "node:http";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../src/app";
import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { integrationTenantId } from "../test/test-helpers";

const CONCURRENT_REQUESTS = Number.parseInt(
  process.env.POOL_STRESS_CONCURRENT?.trim() ?? "500",
  10
);
const DEFAULT_HOLD_MS = 250;
const POOL_CONNECTION_LIMIT = 10;
const POOL_TIMEOUT_SEC = 1;
const STORM_DEADLINE_MS = 90_000;
const POST_STORM_COOLDOWN_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 25;
const MIN_HEARTBEAT_TICKS = 8;
/** Leak = idle-in-TX after cooldown, or active count above pool limit — not idle pool cache. */

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_BASE =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

const emit = process.env.POOL_STRESS_EMIT === "1";

function log(msg: string): void {
  if (emit) {
    process.stderr.write(`${msg}\n`);
  }
}

type ConnectionSnapshot = {
  readonly total: number;
  readonly active: number;
  readonly idle: number;
  readonly idleInTransaction: number;
};

type HttpOutcome =
  | {
      readonly kind: "http";
      readonly index: number;
      readonly status: number;
      readonly durationMs: number;
      readonly body: { ok?: boolean; error?: string };
    }
  | {
      readonly kind: "transport";
      readonly index: number;
      readonly durationMs: number;
      readonly error: string;
    }
  | {
      readonly kind: "client_timeout";
      readonly index: number;
      readonly durationMs: number;
    };

type PoolStressReport = {
  readonly executed: boolean;
  readonly skippedReason?: string;
  readonly concurrent: number;
  readonly holdMs: number;
  readonly poolLimit: number;
  readonly poolTimeoutSec: number;
  readonly count200: number;
  readonly count503: number;
  readonly countOtherHttp: number;
  readonly countTransport: number;
  readonly countClientTimeout: number;
  readonly totalFailures: number;
  readonly stormDurationMs: number;
  readonly maxDurationMs: number;
  readonly heartbeatTicks: number;
  readonly hung: boolean;
  readonly connectionsAtStart: ConnectionSnapshot;
  readonly connectionsAtPeak: ConnectionSnapshot;
  readonly connectionsAfterCooldown: ConnectionSnapshot;
  readonly connectionLeakSuspected: boolean;
  readonly failures: ReadonlyArray<{
    readonly index: number;
    readonly kind: string;
    readonly status?: number;
    readonly durationMs: number;
    readonly detail: string;
  }>;
  readonly verdict: "pass" | "fail" | "skipped";
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
    "x-user-id": "pool-stress-500-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-pool-stress-500",
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

function httpHoldRequest(port: number, tenantId: string, index: number): Promise<HttpOutcome> {
  const start = performance.now();
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/internal/test/db-pool-hold",
        method: "GET",
        headers: authHeaders(tenantId),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const durationMs = performance.now() - start;
          const raw = Buffer.concat(chunks).toString("utf8");
          let body: { ok?: boolean; error?: string } = {};
          if (raw.length > 0) {
            try {
              body = JSON.parse(raw) as { ok?: boolean; error?: string };
            } catch {
              body = { error: "invalid_json" };
            }
          }
          resolve({
            kind: "http",
            index,
            status: res.statusCode ?? 0,
            durationMs,
            body,
          });
        });
      }
    );
    req.on("error", (err) => {
      resolve({
        kind: "transport",
        index,
        durationMs: performance.now() - start,
        error: err instanceof Error ? err.message : String(err),
      });
    });
    req.setTimeout(STORM_DEADLINE_MS + 5_000, () => {
      req.destroy(new Error("client_timeout"));
      resolve({
        kind: "client_timeout",
        index,
        durationMs: performance.now() - start,
      });
    });
    req.end();
  });
}

function buildFailureLog(outcomes: HttpOutcome[]): PoolStressReport["failures"] {
  const failures: PoolStressReport["failures"][number][] = [];
  for (const outcome of outcomes) {
    if (outcome.kind === "http") {
      if (outcome.status === 200) {
        continue;
      }
      failures.push({
        index: outcome.index,
        kind: outcome.status === 503 ? "503_db_pool_saturated" : "unexpected_http",
        status: outcome.status,
        durationMs: Math.round(outcome.durationMs * 10) / 10,
        detail:
          outcome.status === 503
            ? `503 service_unavailable body=${JSON.stringify(outcome.body)}`
            : `HTTP ${outcome.status} body=${JSON.stringify(outcome.body)}`,
      });
    } else if (outcome.kind === "transport") {
      failures.push({
        index: outcome.index,
        kind: "transport_error",
        durationMs: Math.round(outcome.durationMs * 10) / 10,
        detail: outcome.error,
      });
    } else {
      failures.push({
        index: outcome.index,
        kind: "client_timeout",
        durationMs: Math.round(outcome.durationMs * 10) / 10,
        detail: "client destroyed request after deadline",
      });
    }
  }
  return failures;
}

async function runStress(): Promise<PoolStressReport> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return {
      executed: false,
      skippedReason: "DATABASE_URL not set",
      concurrent: CONCURRENT_REQUESTS,
      holdMs: DEFAULT_HOLD_MS,
      poolLimit: POOL_CONNECTION_LIMIT,
      poolTimeoutSec: POOL_TIMEOUT_SEC,
      count200: 0,
      count503: 0,
      countOtherHttp: 0,
      countTransport: 0,
      countClientTimeout: 0,
      totalFailures: 0,
      stormDurationMs: 0,
      maxDurationMs: 0,
      heartbeatTicks: 0,
      hung: false,
      connectionsAtStart: { total: 0, active: 0, idle: 0, idleInTransaction: 0 },
      connectionsAtPeak: { total: 0, active: 0, idle: 0, idleInTransaction: 0 },
      connectionsAfterCooldown: { total: 0, active: 0, idle: 0, idleInTransaction: 0 },
      connectionLeakSuspected: false,
      failures: [],
      verdict: "skipped",
    };
  }

  const runId = randomUUID().slice(0, 8);
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorHoldMs = process.env.P5_DB_HOLD_MS;
  const priorDatabaseUrl = process.env.DATABASE_URL;
  const priorNodeEnv = process.env.NODE_ENV;

  process.env.STORAGE_DRIVER = "prisma";
  process.env.NODE_ENV = "test";
  process.env.P5_DB_HOLD_MS = String(
    Number.parseInt(process.env.P5_DB_HOLD_MS?.trim() ?? String(DEFAULT_HOLD_MS), 10) ||
      DEFAULT_HOLD_MS
  );
  process.env.DATABASE_URL = withPoolTestUrl(databaseUrl);
  await disconnectPrisma();

  const holdMs = Number.parseInt(process.env.P5_DB_HOLD_MS, 10);
  const admin = getPrismaAdmin();
  const tenantId = integrationTenantId();

  let server: http.Server | undefined;
  let peakSnapshot: ConnectionSnapshot = {
    total: 0,
    active: 0,
    idle: 0,
    idleInTransaction: 0,
  };

  try {
    await admin.tenant.create({
      data: {
        id: tenantId,
        subdomain: `pool500-${runId}`,
        workspaceType: "starter",
        theme: {},
      },
    });

    const listener = createRequestListener({
      toursService: {
        createTour: async () => {
          throw new Error("pool-stress-500: toursService not used");
        },
        getTourById: async () => null,
      },
    });
    server = http.createServer(listener);
    const port = await new Promise<number>((resolve, reject) => {
      server!.listen(0, () => {
        const addr = server!.address();
        if (!addr || typeof addr === "string") {
          reject(new Error("pool-stress-500: no listen address"));
          return;
        }
        resolve(addr.port);
      });
    });

    const connectionsAtStart = await countAppTourConnections(admin);
    log(`start connections=${JSON.stringify(connectionsAtStart)} port=${port}`);

    let heartbeatTicks = 0;
    const heartbeat = setInterval(() => {
      heartbeatTicks += 1;
    }, HEARTBEAT_INTERVAL_MS);

    const peakSampler = setInterval(async () => {
      try {
        const snap = await countAppTourConnections(admin);
        if (snap.total > peakSnapshot.total) {
          peakSnapshot = snap;
        }
        if (snap.idleInTransaction > peakSnapshot.idleInTransaction) {
          peakSnapshot = snap;
        }
      } catch {
        // sampling best-effort during storm
      }
    }, 50);

    const stormStart = performance.now();
    let hung = false;

    const results = await Promise.race([
      Promise.all(
        Array.from({ length: CONCURRENT_REQUESTS }, (_, index) =>
          httpHoldRequest(port, tenantId, index)
        )
      ),
      new Promise<HttpOutcome[]>((resolve) => {
        setTimeout(() => {
          hung = true;
          resolve([]);
        }, STORM_DEADLINE_MS);
      }),
    ]);

    clearInterval(heartbeat);
    clearInterval(peakSampler);
    const stormDurationMs = performance.now() - stormStart;

    await new Promise((r) => setTimeout(r, POST_STORM_COOLDOWN_MS));
    const connectionsAfterCooldown = await countAppTourConnections(admin);

    const httpOutcomes = results.filter((r) => r.kind === "http") as Extract<
      HttpOutcome,
      { kind: "http" }
    >[];
    const count200 = httpOutcomes.filter((r) => r.status === 200).length;
    const count503 = httpOutcomes.filter((r) => r.status === 503).length;
    const countOtherHttp = httpOutcomes.filter((r) => r.status !== 200 && r.status !== 503).length;
    const countTransport = results.filter((r) => r.kind === "transport").length;
    const countClientTimeout = results.filter((r) => r.kind === "client_timeout").length;
    const maxDurationMs = Math.max(...results.map((r) => r.durationMs), 0);
    const failures = buildFailureLog(results);
    const totalFailures = failures.length;

    const connectionLeakSuspected =
      connectionsAfterCooldown.idleInTransaction > 0 ||
      connectionsAfterCooldown.active > POOL_CONNECTION_LIMIT;

    let verdict: PoolStressReport["verdict"] = "fail";
    if (
      !hung &&
      results.length === CONCURRENT_REQUESTS &&
      count503 > 0 &&
      countOtherHttp === 0 &&
      countTransport === 0 &&
      countClientTimeout === 0 &&
      heartbeatTicks >= MIN_HEARTBEAT_TICKS &&
      !connectionLeakSuspected
    ) {
      verdict = "pass";
    }

    return {
      executed: true,
      concurrent: CONCURRENT_REQUESTS,
      holdMs,
      poolLimit: POOL_CONNECTION_LIMIT,
      poolTimeoutSec: POOL_TIMEOUT_SEC,
      count200,
      count503,
      countOtherHttp,
      countTransport,
      countClientTimeout,
      totalFailures,
      stormDurationMs: Math.round(stormDurationMs * 10) / 10,
      maxDurationMs: Math.round(maxDurationMs * 10) / 10,
      heartbeatTicks,
      hung,
      connectionsAtStart,
      connectionsAtPeak: peakSnapshot,
      connectionsAfterCooldown,
      connectionLeakSuspected,
      failures,
      verdict,
    };
  } finally {
    server?.close();
    try {
      await admin.tenant.delete({ where: { id: tenantId } });
    } catch {
      // tenant may already be gone
    }
    await disconnectPrisma();
    process.env.STORAGE_DRIVER = priorStorageDriver;
    process.env.P5_DB_HOLD_MS = priorHoldMs;
    process.env.DATABASE_URL = priorDatabaseUrl;
    process.env.NODE_ENV = priorNodeEnv;
  }
}

async function main(): Promise<void> {
  const report = await runStress();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.verdict === "pass" ? 0 : report.verdict === "skipped" ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exit(1);
});
