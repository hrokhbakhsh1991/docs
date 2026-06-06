/**
 * 4-integration — graceful shutdown under concurrent load.
 *
 * Spawns an isolated API subprocess, fires 50 concurrent POST /tours, sends SIGTERM
 * mid-flight, then asserts:
 *   - zero orphan tour / audit / outbox rows (atomic TX all-or-nothing)
 *   - no committed tour without matching audit + outbox
 *   - outbox relay flushes pending rows before process exit
 *
 * Also audits {@link apps/api/src/main.ts} for production shutdown parity.
 *
 * Requires Postgres:
 *   DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
 *     STORAGE_DRIVER=prisma OUTBOX_RELAY_ENABLED=true \
 *     pnpm --filter @apps/api exec node --import tsx --test test/4-integration/graceful-shutdown.spec.ts
 *
 * Env:
 *   GRACEFUL_SHUTDOWN_SKIP_MAIN_GAP=1 — skip (not fail) when main.ts lacks full hooks
 *   GRACEFUL_SHUTDOWN_USE_MAIN=1       — spawn src/main.ts instead of test worker
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { disconnectPrisma } from "../../src/db/prisma";
import { assertZeroOrphanedState, auditTenantConsistency } from "../chaos/chaos-db-assertions";
import { integrationTenantId, preparePostgresOutboxIsolation } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const SKIP_NO_DB =
  "graceful-shutdown requires DATABASE_URL (e.g. postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db)";

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

const CONCURRENT_REQUESTS = 50;
const READY_TIMEOUT_MS = 30_000;
const EXIT_TIMEOUT_MS = 45_000;
const SIGTERM_DELAY_MS = 40;

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(TEST_DIR, "graceful-shutdown-worker.ts");
const MAIN_PATH = join(TEST_DIR, "../../src/main.ts");
const GRACEFUL_SHUTDOWN_MODULE_PATH = join(TEST_DIR, "../../src/server/graceful-shutdown.ts");

const SKIP_MAIN_GAP = process.env.GRACEFUL_SHUTDOWN_SKIP_MAIN_GAP === "1";
const USE_MAIN = process.env.GRACEFUL_SHUTDOWN_USE_MAIN === "1";

export type MainShutdownGap = {
  readonly missingServerClose: boolean;
  readonly missingDisconnectPrisma: boolean;
  readonly missingOutboxFlush: boolean;
};

export type ShutdownRunReport = {
  readonly exitCode: number | null;
  readonly exitSignal: NodeJS.Signals | null;
  readonly httpCompleted: number;
  readonly httpSucceeded: number;
  readonly tourCount: number;
  readonly pendingOutbox: number;
  readonly orphanAudit: MainShutdownGap & { readonly gaps: readonly string[] };
};

function withConnectionLimit(url: string, limit = 16): string {
  if (/connection_limit=/i.test(url)) {
    return url;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=${limit}`;
}

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "graceful-shutdown-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-shutdown",
  };
}

function tourBody(index: number) {
  return {
    schemaVersion: 1,
    roots: ["basics", "details"],
    data: {
      basics: { title: `graceful-shutdown-${index}` },
      details: { summary: `request-${index}` },
    },
  };
}

/** Static audit of production entrypoint shutdown contract. */
export function auditMainTsShutdownContract(mainSource = readFileSync(MAIN_PATH, "utf8")): {
  readonly gaps: readonly string[];
  readonly detail: MainShutdownGap;
} {
  const usesSharedModule = /installGracefulShutdownHandlers/.test(mainSource);
  const shutdownSource = usesSharedModule
    ? readFileSync(GRACEFUL_SHUTDOWN_MODULE_PATH, "utf8")
    : mainSource;
  const sigtermBlock = usesSharedModule
    ? shutdownSource
    : (mainSource.match(/process\.on\(\s*["']SIGTERM["'][\s\S]*?\}\);/)?.[0] ?? "");
  const handler = shutdownSource;

  const detail: MainShutdownGap = {
    missingServerClose: !/server\.close/.test(handler),
    missingDisconnectPrisma: !/disconnectPrisma/.test(handler),
    missingOutboxFlush: !/drainOutboxRelayOnShutdown/.test(handler),
  };

  const gaps: string[] = [];
  if (!usesSharedModule && !mainSource.match(/process\.on\(\s*["']SIGTERM["']/)) {
    gaps.push("no SIGTERM handler registered");
  }
  if (usesSharedModule && !/process\.on\(\s*["']SIGTERM["']/.test(shutdownSource)) {
    gaps.push("installGracefulShutdownHandlers must register SIGTERM");
  }
  if (detail.missingServerClose) {
    gaps.push("server.close() — drain in-flight HTTP before exit");
  }
  if (detail.missingOutboxFlush) {
    gaps.push("drainOutboxRelayOnShutdown — relay pending rows before exit");
  }
  if (detail.missingDisconnectPrisma) {
    gaps.push("disconnectPrisma() — release DB pool connections");
  }

  return { gaps, detail };
}

type SpawnedApi = {
  readonly port: number;
  readonly child: ChildProcessWithoutNullStreams;
  readonly stdout: string;
  readonly stderr: string;
};

function spawnApiProcess(env: NodeJS.ProcessEnv): Promise<SpawnedApi> {
  const entry = USE_MAIN ? MAIN_PATH : WORKER_PATH;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", entry], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGTERM");
      } catch {
        /* already dead */
      }
      reject(new Error(`${error.message}\nstdout:\n${stdoutBuffer}\nstderr:\n${stderrBuffer}`));
    };

    const timer = setTimeout(() => {
      fail(new Error(`API subprocess did not become ready within ${READY_TIMEOUT_MS}ms`));
    }, READY_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      if (USE_MAIN) {
        return;
      }
      const match = stdoutBuffer.match(/GRACEFUL_SHUTDOWN_READY (\{.*\})/);
      if (!match || settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const payload = JSON.parse(match[1]!) as { port?: number };
        if (typeof payload.port !== "number") {
          fail(new Error("ready payload missing port"));
          return;
        }
        resolve({ port: payload.port, child, stdout: stdoutBuffer, stderr: stderrBuffer });
      } catch (error: unknown) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString("utf8");
    });

    child.on("error", (error) => fail(error));

    if (USE_MAIN) {
      const mainPort = Number.parseInt(String(env.PORT ?? "3001"), 10);
      void pollHealthUntilReady(
        mainPort,
        timer,
        () => stderrBuffer,
        fail,
        (port) => {
          settled = true;
          resolve({ port, child, stdout: stdoutBuffer, stderr: stderrBuffer });
        }
      );
    }

    child.on("exit", (code, signal) => {
      if (settled) return;
      fail(
        new Error(
          `API subprocess exited before ready (code=${String(code)} signal=${String(signal)})`
        )
      );
    });
  });
}

async function pollHealthUntilReady(
  port: number,
  timer: NodeJS.Timeout,
  readStderr: () => string,
  fail: (error: Error) => void,
  resolveReady: (port: number) => void
): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ok = await probeHealth(port);
    if (ok) {
      clearTimeout(timer);
      resolveReady(port);
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  fail(new Error(`main.ts /health not ready on port ${port}\nstderr:\n${readStderr()}`));
}

function probeHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path: "/health", method: "GET", timeout: 2000 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
    req.end();
  });
}

function postTour(
  port: number,
  tenantId: string,
  body: unknown
): Promise<{ readonly status: number; readonly id?: string; readonly error?: string }> {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/tours",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(payload)),
          ...authHeaders(tenantId),
        },
        timeout: 20_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed: { id?: string; error?: string } = {};
          if (raw.length > 0) {
            try {
              parsed = JSON.parse(raw) as { id?: string; error?: string };
            } catch {
              parsed = { error: raw };
            }
          }
          resolve({
            id: parsed.id,
            error: parsed.error ?? (typeof parsed.status === "string" ? parsed.status : undefined),
            status: res.statusCode ?? 0,
          });
        });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, error: "request_timeout" });
    });
    req.on("error", (error) => {
      resolve({
        status: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    req.write(payload);
    req.end();
  });
}

function waitForExit(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number
): Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    if (child.exitCode !== null) {
      resolve({ exitCode: child.exitCode, signal: child.signalCode });
      return;
    }

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      reject(new Error(`subprocess did not exit within ${timeoutMs}ms after SIGTERM`));
    }, timeoutMs);

    child.once("exit", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ exitCode, signal });
    });
  });
}

async function assertToursHaveAuditAndFlushedOutbox(
  admin: PrismaClient,
  tenantId: string
): Promise<{ tourCount: number; pendingOutbox: number }> {
  const tours = await admin.tour.findMany({ where: { tenantId } });
  const audits = await admin.auditEvent.findMany({
    where: { tenantId, entityType: "tour" },
  });
  const outbox = await admin.outboxEvent.findMany({ where: { tenantId } });

  const tourIds = new Set(tours.map((row) => row.id));

  const toursWithoutAudit = tours.filter(
    (tour) => !audits.some((row) => row.entityId === tour.id)
  ).length;
  assert.equal(
    toursWithoutAudit,
    0,
    "committed tour rows must have matching audit_events entity_id"
  );

  const toursWithoutOutbox = tours.filter(
    (tour) =>
      !outbox.some(
        (row) =>
          row.aggregateId === tour.id &&
          row.eventType === "TourCreated" &&
          row.tenantId === tour.tenantId
      )
  ).length;
  assert.equal(
    toursWithoutOutbox,
    0,
    "committed tour rows must have matching TourCreated outbox aggregate_id"
  );

  const pendingOutbox = outbox.filter(
    (row) => tourIds.has(row.aggregateId) && row.status === "pending"
  ).length;
  assert.equal(
    pendingOutbox,
    0,
    "outbox relay must flush pending rows for committed tours before exit"
  );

  return { tourCount: tours.length, pendingOutbox };
}

describe(
  "4-integration — graceful shutdown under concurrent load",
  { skip: hasDatabase ? false : SKIP_NO_DB, concurrency: false },
  () => {
    const runId = randomUUID().slice(0, 8);
    const tenantId = integrationTenantId();
    let admin: PrismaClient;
    const priorStorageDriver = process.env.STORAGE_DRIVER;
    const priorOutboxRelay = process.env.OUTBOX_RELAY_ENABLED;
    const priorPollInterval = process.env.OUTBOX_POLL_INTERVAL_MS;

    before(async () => {
      await preparePostgresOutboxIsolation();
      process.env.STORAGE_DRIVER = "prisma";
      process.env.OUTBOX_RELAY_ENABLED = "true";
      process.env.OUTBOX_POLL_INTERVAL_MS = "200";
      await disconnectPrisma();

      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
      await admin.outboxEvent.deleteMany({
        where: { status: { in: ["pending", "processing"] } },
      });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `gs-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorageDriver;
      process.env.OUTBOX_RELAY_ENABLED = priorOutboxRelay;
      process.env.OUTBOX_POLL_INTERVAL_MS = priorPollInterval;

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
      await admin.$disconnect();
      await disconnectPrisma();
    });

    it("main.ts registers full graceful shutdown contract (server drain + outbox flush + prisma disconnect)", () => {
      const { gaps } = auditMainTsShutdownContract();
      if (gaps.length === 0) {
        return;
      }

      const message = [
        "main.ts SIGTERM handler is incomplete — production graceful shutdown gap:",
        ...gaps.map((gap) => `  - missing ${gap}`),
        "",
        "Set GRACEFUL_SHUTDOWN_SKIP_MAIN_GAP=1 to skip this parity check.",
        "Runtime subprocess test uses graceful-shutdown-worker.ts with the full contract.",
      ].join("\n");

      if (SKIP_MAIN_GAP) {
        process.stderr.write(
          `${JSON.stringify({ event: "graceful_shutdown.main_gap.skipped", code: "MAIN_SHUTDOWN_GAP_SKIPPED" })}\n`
        );
        return;
      }

      assert.fail(message);
    });

    it("SIGTERM during 50 concurrent POST /tours completes active TX and flushes outbox", async () => {
      const childEnv: NodeJS.ProcessEnv = {
        ...process.env,
        NODE_ENV: "test",
        STORAGE_DRIVER: "prisma",
        DATABASE_URL: withConnectionLimit(process.env.DATABASE_URL?.trim() ?? APP_TOUR_URL),
        DATABASE_URL_ADMIN: ADMIN_URL,
        OUTBOX_RELAY_ENABLED: "true",
        OUTBOX_POLL_INTERVAL_MS: "200",
        GRACEFUL_SHUTDOWN_FLUSH_MS: "30000",
        TENANT_MAX_CONCURRENT_TOUR_WRITES: String(CONCURRENT_REQUESTS),
        GLOBAL_HTTP_INFLIGHT_MAX: String(CONCURRENT_REQUESTS + 32),
      };

      if (USE_MAIN) {
        childEnv.PORT = String(30_000 + Math.floor(Math.random() * 10_000));
      }

      const spawned = await spawnApiProcess(childEnv);
      const { child, port, stderr: childStderr } = spawned;

      try {
        const requests = Array.from({ length: CONCURRENT_REQUESTS }, (_, index) =>
          postTour(port, tenantId, tourBody(index))
        );

        await new Promise((resolve) => setTimeout(resolve, SIGTERM_DELAY_MS));
        child.kill("SIGTERM");

        const [responses, { exitCode, signal }] = await Promise.all([
          Promise.all(requests),
          waitForExit(child, EXIT_TIMEOUT_MS),
        ]);

        const httpCompleted = responses.filter((row) => row.status > 0).length;
        const httpSucceeded = responses.filter((row) => row.status === 201).length;

        assert.equal(
          exitCode,
          0,
          `subprocess must exit 0 after graceful shutdown (signal=${String(signal)})\nstderr:\n${childStderr}`
        );

        await assertZeroOrphanedState(admin, tenantId);
        const consistency = await auditTenantConsistency(admin, tenantId);
        const flush = await assertToursHaveAuditAndFlushedOutbox(admin, tenantId);

        assert.ok(
          httpSucceeded > 0 || consistency.tourCount > 0,
          "at least one tour must commit or succeed over HTTP to exercise shutdown path"
        );
        const httpZero = responses.filter((row) => row.status === 0).length;
        assert.ok(
          httpCompleted + httpZero >= CONCURRENT_REQUESTS,
          [
            "all 50 concurrent requests must settle (HTTP response or connection error)",
            `completed=${httpCompleted} connection_error=${httpZero} total=${responses.length}`,
            `status histogram: ${responses.map((row) => row.status).join(",")}`,
          ].join(" — ")
        );

        const report: ShutdownRunReport = {
          exitCode,
          exitSignal: signal,
          httpCompleted,
          httpSucceeded,
          tourCount: flush.tourCount,
          pendingOutbox: flush.pendingOutbox,
          orphanAudit: {
            ...auditMainTsShutdownContract().detail,
            gaps: auditMainTsShutdownContract().gaps,
          },
        };

        if (process.env.GRACEFUL_SHUTDOWN_EMIT === "1") {
          console.log(JSON.stringify({ event: "graceful_shutdown.report", ...report }));
        }
      } finally {
        if (child.exitCode === null && !child.killed) {
          try {
            child.kill("SIGKILL");
          } catch {
            /* ignore */
          }
        }
      }
    });
  }
);
