/**
 * 3-performance — Prisma connection pool saturation under concurrent load.
 *
 * Fires 100 parallel GET /internal/test/db-pool-hold requests while each TX holds
 * a connection for P5_DB_HOLD_MS (default 200). Pool size is pinned to 10 so the
 * queue must reject or complete within pool_timeout — never block the event loop.
 *
 * Requires Postgres (DATABASE_URL). Skipped when unset.
 *
 * Run:
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=prisma \
 *     DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=10&pool_timeout=1' \
 *     P5_DB_HOLD_MS=250 \
 *     node --import tsx --test test/3-performance/db-pool-saturation.spec.ts
 *
 * @see docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md DEC-012
 * @see docs/phase-5/appendices/connection-budget.md DEC-055 — raise tenant cap so global pool binds first
 */
import assert from "node:assert/strict";
import http from "node:http";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../../src/app";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const CONCURRENT_REQUESTS = 100;
const DEFAULT_HOLD_MS = 250;
const POOL_CONNECTION_LIMIT = 10;
/** Acquire timeout (seconds) — must be shorter than worst-case queue wait for slot > pool size. */
const POOL_TIMEOUT_SEC = 1;
const STORM_DEADLINE_MS = 45_000;
const SUITE_TIMEOUT_MS = 60_000;
const MIN_HEARTBEAT_TICKS = 8;
const HEARTBEAT_INTERVAL_MS = 25;

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_BASE =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

export type DbPoolSaturationReport = {
  readonly verdict: "pass_503" | "pass_timely" | "fail";
  readonly concurrent: number;
  readonly holdMs: number;
  readonly poolLimit: number;
  readonly count503: number;
  readonly count200: number;
  readonly countOther: number;
  readonly maxDurationMs: number;
  readonly stormDurationMs: number;
  readonly heartbeatTicks: number;
  readonly hung: boolean;
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
    "x-user-id": "db-pool-perf-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-pool-perf",
  };
}

type HttpResult = {
  readonly status: number;
  readonly body: { ok?: boolean; error?: string };
  readonly durationMs: number;
};

describe(
  "db pool saturation (3-performance)",
  { skip: !hasDatabase, concurrency: false, timeout: SUITE_TIMEOUT_MS },
  () => {
    const runId = randomUUID().slice(0, 8);
    let tenantId: string;
    let admin: PrismaClient;
    let listener: ReturnType<typeof createRequestListener>;
    let server: http.Server;
    let port = 0;
    const priorStorageDriver = process.env.STORAGE_DRIVER;
    const priorHoldMs = process.env.P5_DB_HOLD_MS;
    const priorDatabaseUrl = process.env.DATABASE_URL;
    const priorTenantMaxOps = process.env.TENANT_MAX_CONCURRENT_DB_OPS;
    let lastReport: DbPoolSaturationReport | undefined;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.NODE_ENV = "test";
      // Global pool must saturate before per-tenant budget (DEC-055) rejects this probe.
      process.env.TENANT_MAX_CONCURRENT_DB_OPS = "100";
      process.env.P5_DB_HOLD_MS = String(
        Number.parseInt(process.env.P5_DB_HOLD_MS?.trim() ?? String(DEFAULT_HOLD_MS), 10) ||
          DEFAULT_HOLD_MS
      );
      process.env.DATABASE_URL = withPoolTestUrl(process.env.DATABASE_URL?.trim() ?? APP_TOUR_BASE);
      await disconnectPrisma();
      admin = getPrismaAdmin();

      tenantId = integrationTenantId();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `pool-sat-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });

      listener = createRequestListener({
        toursService: {
          createTour: async () => {
            throw new Error("db-pool-saturation: toursService not used");
          },
          getTourById: async () => null,
        },
      });
      server = http.createServer(listener);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        throw new Error("db-pool-saturation: no listen address");
      }
      port = addr.port;
    });

    after(async () => {
      server.close();
      process.env.STORAGE_DRIVER = priorStorageDriver;
      process.env.P5_DB_HOLD_MS = priorHoldMs;
      process.env.DATABASE_URL = priorDatabaseUrl;
      if (priorTenantMaxOps === undefined) {
        delete process.env.TENANT_MAX_CONCURRENT_DB_OPS;
      } else {
        process.env.TENANT_MAX_CONCURRENT_DB_OPS = priorTenantMaxOps;
      }
      try {
        await admin.tenant.delete({ where: { id: tenantId } });
      } catch {
        // tenant may already be gone
      }
      await disconnectPrisma();
    });

    async function httpHoldRequest(): Promise<HttpResult> {
      const start = performance.now();
      return new Promise((resolve, reject) => {
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
              let body: HttpResult["body"] = {};
              if (raw.length > 0) {
                try {
                  body = JSON.parse(raw) as HttpResult["body"];
                } catch {
                  body = { error: "invalid_json" };
                }
              }
              resolve({ status: res.statusCode ?? 0, body, durationMs });
            });
          }
        );
        req.on("error", reject);
        req.setTimeout(STORM_DEADLINE_MS + 5_000, () => {
          req.destroy(new Error("client_timeout"));
        });
        req.end();
      });
    }

    it("queues under pool saturation — 503 or timely completion, event loop stays alive", async () => {
      let heartbeatTicks = 0;
      const heartbeat = setInterval(() => {
        heartbeatTicks += 1;
      }, HEARTBEAT_INTERVAL_MS);

      const stormStart = performance.now();
      let hung = false;

      const results = await Promise.race([
        Promise.allSettled(Array.from({ length: CONCURRENT_REQUESTS }, () => httpHoldRequest())),
        new Promise<PromiseSettledResult<HttpResult>[]>((resolve) => {
          setTimeout(() => {
            hung = true;
            resolve([]);
          }, STORM_DEADLINE_MS);
        }),
      ]);

      clearInterval(heartbeat);
      const stormDurationMs = performance.now() - stormStart;

      assert.equal(hung, false, `storm hung — no HTTP completion within ${STORM_DEADLINE_MS}ms`);

      const settled = results.filter(
        (r): r is PromiseFulfilledResult<HttpResult> => r.status === "fulfilled"
      );
      const rejected = results.filter((r) => r.status === "rejected");
      assert.equal(
        settled.length + rejected.length,
        CONCURRENT_REQUESTS,
        "expected one settled result per concurrent request"
      );

      const httpResults = settled.map((r) => r.value);
      for (const failure of rejected) {
        const message =
          failure.reason instanceof Error ? failure.reason.message : String(failure.reason);
        assert.fail(`unexpected transport failure: ${message}`);
      }

      const count503 = httpResults.filter((r) => r.status === 503).length;
      const count200 = httpResults.filter((r) => r.status === 200).length;
      const countOther = httpResults.length - count503 - count200;
      const maxDurationMs = Math.max(...httpResults.map((r) => r.durationMs), 0);

      const timely =
        stormDurationMs <= STORM_DEADLINE_MS &&
        httpResults.every((r) => r.status > 0 && r.durationMs <= STORM_DEADLINE_MS);
      const saw503 = count503 > 0;

      let verdict: DbPoolSaturationReport["verdict"] = "fail";
      if (saw503 && timely && heartbeatTicks >= MIN_HEARTBEAT_TICKS) {
        verdict = "pass_503";
      } else if (timely && heartbeatTicks >= MIN_HEARTBEAT_TICKS && countOther === 0) {
        verdict = "pass_timely";
      }

      lastReport = {
        verdict,
        concurrent: CONCURRENT_REQUESTS,
        holdMs: Number.parseInt(process.env.P5_DB_HOLD_MS ?? String(DEFAULT_HOLD_MS), 10),
        poolLimit: POOL_CONNECTION_LIMIT,
        count503,
        count200,
        countOther,
        maxDurationMs,
        stormDurationMs,
        heartbeatTicks,
        hung,
      };

      if (process.env.DB_POOL_SAT_EMIT === "1") {
        console.info(JSON.stringify(lastReport, null, 2));
      }

      assert.ok(
        heartbeatTicks >= MIN_HEARTBEAT_TICKS,
        `event loop stalled — heartbeat ticks=${heartbeatTicks} (min ${MIN_HEARTBEAT_TICKS})`
      );

      assert.ok(
        saw503,
        [
          "pool saturation must surface HTTP 503 (service_unavailable), not hang or 500-only storm",
          `  count503=${count503} count200=${count200} countOther=${countOther}`,
          `  stormDurationMs=${stormDurationMs.toFixed(1)} maxDurationMs=${maxDurationMs.toFixed(1)}`,
          `  pool_limit=${POOL_CONNECTION_LIMIT} holdMs=${process.env.P5_DB_HOLD_MS}`,
        ].join("\n")
      );

      assert.equal(countOther, 0, `unexpected statuses during saturation (other=${countOther})`);

      for (const res of httpResults.filter((r) => r.status === 503)) {
        assert.equal(res.body.error, "service_unavailable");
      }

      assert.equal(verdict, "pass_503");
    });
  }
);
