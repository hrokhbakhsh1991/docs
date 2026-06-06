#!/usr/bin/env node
/**
 * Verify tenant + trace AsyncLocalStorage is cleared after each HTTP request.
 *
 * Probes:
 *   1. Direct ALS lifecycle (mirrors context-resilience / bind-request-context)
 *   2. Instrumented HTTP listener — after handler, microtask, setImmediate, between bursts
 *   3. Detached schedulers — setImmediate scheduled inside bind but not awaited (footgun)
 *
 * Run:
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory npx tsx scripts/verify-als-request-cleanup.ts
 *
 * Exit 0 = no residual ALS outside active request scopes; exit 1 = leaks recorded.
 */
import http from "node:http";
import { randomUUID } from "node:crypto";

import { createRequestListener } from "../src/app";
import { runWithHttpRequestContext } from "../src/http/bind-request-context";
import { getActiveTraceId, runWithTraceContext } from "../src/observability/trace-request-context";
import { getActiveTenantId, runWithTenantContext } from "../src/tenant/tenant-request-context";
import { createTestToursService, integrationTenantId } from "../test/test-helpers";

type AlsResidual = {
  readonly phase: string;
  readonly requestIndex?: number;
  readonly path?: string;
  readonly tenantId?: string;
  readonly traceId?: string;
  readonly note?: string;
};

/** Post-request HTTP probes — must stay empty for production safety. */
const httpPostRequestResiduals: AlsResidual[] = [];
/** Node ALS footgun probes (unawaited schedulers) — documented, not HTTP listener bugs. */
const footgunResiduals: AlsResidual[] = [];

const POST_REQUEST_PHASES = new Set([
  "http:before-request",
  "http:after-handler-await",
  "http:post-handler-microtask",
  "http:post-handler-setImmediate",
  "http:after-burst-setImmediate",
  "http:after-tours-post",
  "direct:",
  "detached:after-detached-probes",
]);

function snapshot(): { tenantId?: string; traceId?: string } {
  return {
    tenantId: getActiveTenantId(),
    traceId: getActiveTraceId(),
  };
}

function recordIfResidual(
  phase: string,
  extra?: Omit<AlsResidual, "phase" | "tenantId" | "traceId">
): void {
  const { tenantId, traceId } = snapshot();
  if (tenantId === undefined && traceId === undefined) {
    return;
  }
  const row: AlsResidual = { phase, tenantId, traceId, ...extra };
  if (phase.startsWith("detached:")) {
    footgunResiduals.push(row);
    return;
  }
  if (phase.startsWith("http:") || phase.startsWith("direct:")) {
    httpPostRequestResiduals.push(row);
  }
}

function assertCleared(phase: string): void {
  recordIfResidual(phase);
}

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "als-verify-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-als-verify",
    "x-correlation-id": `trace-${tenantId.slice(0, 8)}`,
  };
}

async function delaySetImmediate(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

async function verifyDirectAlsLifecycle(): Promise<void> {
  const tenantA = integrationTenantId();
  const tenantB = integrationTenantId();
  const traceA = randomUUID();

  assertCleared("direct:baseline");

  try {
    await runWithTenantContext(tenantA, async () => {
      await Promise.reject(new Error("ALS_VERIFY_REJECT"));
    });
  } catch {
    /* expected */
  }
  assertCleared("direct:after-tenant-reject");

  await runWithTraceContext(traceA, async () => {
    await runWithTenantContext(tenantB, async () => {
      assert.equal(getActiveTraceId(), traceA);
      assert.equal(getActiveTenantId(), tenantB);
    });
    assert.equal(getActiveTraceId(), traceA);
    assert.equal(getActiveTenantId(), undefined);
  });
  assertCleared("direct:after-nested-trace-tenant");

  const fakeReq = { headers: { "x-correlation-id": "http-sim-trace" } } as http.IncomingMessage;
  const auth = {
    tenantId: tenantA,
    userId: "u1",
    role: "admin" as const,
    membershipStatus: "ACTIVE" as const,
    workspaceId: "ws1",
  };
  await runWithHttpRequestContext(fakeReq, auth, async () => {
    assert.equal(getActiveTenantId(), tenantA);
    assert.equal(getActiveTraceId(), "http-sim-trace");
  });
  assertCleared("direct:after-runWithHttpRequestContext");
}

/** Minimal assert helper — avoid pulling node:test into script. */
const assert = {
  equal<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(message ?? `expected ${String(expected)}, got ${String(actual)}`);
    }
  },
};

async function verifyDetachedSchedulers(): Promise<void> {
  const tenantA = integrationTenantId();
  const detached: Array<{ tenantId?: string; traceId?: string }> = [];

  await runWithTraceContext("trace-detached", () =>
    runWithTenantContext(tenantA, async () => {
      setImmediate(() => {
        detached.push(snapshot());
      });
      // Intentionally do not await setImmediate — simulates fire-and-forget from handler.
    })
  );

  await delaySetImmediate();
  await delaySetImmediate();

  for (const row of detached) {
    if (row.tenantId !== undefined || row.traceId !== undefined) {
      footgunResiduals.push({
        phase: "detached:setImmediate-after-run",
        tenantId: row.tenantId,
        traceId: row.traceId,
        note: "ALS visible in unawaited setImmediate after bind promise settled — cross-request bleed risk",
      });
    }
  }

  assertCleared("detached:after-detached-probes");
}

function createInstrumentedListener(): (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => Promise<void> {
  const base = createRequestListener({ toursService: createTestToursService() });
  let requestIndex = 0;

  return async (req, res) => {
    const index = ++requestIndex;
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    recordIfResidual("http:before-request", { requestIndex: index, path });

    try {
      await base(req, res);
    } finally {
      recordIfResidual("http:after-handler-await", { requestIndex: index, path });
    }

    queueMicrotask(() => {
      recordIfResidual("http:post-handler-microtask", { requestIndex: index, path });
    });
    setImmediate(() => {
      recordIfResidual("http:post-handler-setImmediate", { requestIndex: index, path });
    });
  };
}

async function httpGet(
  port: number,
  path: string,
  headers?: Record<string, string>
): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path, method: "GET", headers },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function httpPost(
  port: number,
  path: string,
  body: unknown,
  headers: Record<string, string>
): Promise<number> {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(payload)),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function verifyHttpRequestCleanup(): Promise<void> {
  const listener = createInstrumentedListener();
  const server = http.createServer(listener);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    server.close();
    throw new Error("no listen address");
  }
  const port = addr.port;

  const tenantA = integrationTenantId();
  const tenantB = integrationTenantId();

  const paths: Array<{ method: "GET" | "POST"; path: string; tenantId?: string }> = [
    { method: "GET", path: "/health" },
    { method: "GET", path: "/api/v2/tenant-config", tenantId: tenantA },
    { method: "GET", path: "/api/v2/tenant-config", tenantId: tenantB },
  ];

  const BURST = 80;
  const tasks: Promise<number>[] = [];

  for (let i = 0; i < BURST; i += 1) {
    const tenantId = i % 2 === 0 ? tenantA : tenantB;
    const route = paths[i % paths.length]!;
    if (route.method === "GET") {
      const headers = route.tenantId ? authHeaders(route.tenantId) : undefined;
      tasks.push(httpGet(port, route.path, headers));
    }
  }

  await Promise.all(tasks);
  await delaySetImmediate();
  await delaySetImmediate();
  assertCleared("http:after-burst-setImmediate");

  // POST /tours — binds tenant ALS (invalid body → fast 4xx, still exercises bind)
  const tourStatuses = await Promise.all([
    httpPost(
      port,
      "/tours",
      { data: { basics: {}, details: { summary: "x" } } },
      authHeaders(tenantA)
    ),
    httpPost(
      port,
      "/tours",
      { data: { basics: {}, details: { summary: "x" } } },
      authHeaders(tenantB)
    ),
  ]);

  await delaySetImmediate();
  assertCleared("http:after-tours-post");

  server.close();
  await new Promise<void>((resolve) => server.on("close", resolve));

  if (tourStatuses.some((s) => s === 0)) {
    throw new Error("tours POST did not complete");
  }
}

function printReport(): void {
  process.stderr.write("\n--- verify-als-request-cleanup ---\n");
  const httpOk = httpPostRequestResiduals.length === 0;
  if (httpOk) {
    process.stderr.write(
      "PASS (HTTP): tenant + trace ALS cleared after each request (after-handler, microtask, setImmediate, burst).\n"
    );
  } else {
    process.stderr.write(
      `FAIL (HTTP): ${httpPostRequestResiduals.length} post-request residual ALS probe(s):\n`
    );
    for (const row of httpPostRequestResiduals) {
      process.stderr.write(formatRow(row));
    }
  }
  if (footgunResiduals.length > 0) {
    process.stderr.write(
      `WARN (footgun): ${footgunResiduals.length} — unawaited setImmediate retains ALS after bind settles (see ALS-FOOTGUN-01 in phase2-paranoid-audit.md):\n`
    );
    for (const row of footgunResiduals) {
      process.stderr.write(formatRow(row));
    }
  }
  process.stderr.write("\nJSON:\n");
  process.stderr.write(
    JSON.stringify(
      {
        httpOk,
        httpPostRequestResiduals,
        footgunResiduals,
        postRequestPhasesChecked: [...POST_REQUEST_PHASES],
      },
      null,
      2
    )
  );
  process.stderr.write("\n");
}

function formatRow(row: AlsResidual): string {
  return `  phase=${row.phase} tenant=${row.tenantId ?? "—"} trace=${row.traceId ?? "—"} req=${row.requestIndex ?? "—"} path=${row.path ?? "—"} ${row.note ?? ""}\n`;
}

async function main(): Promise<void> {
  process.env.NODE_ENV ??= "test";
  process.env.STORAGE_DRIVER ??= "memory";

  await verifyDirectAlsLifecycle();
  await verifyDetachedSchedulers();
  await verifyHttpRequestCleanup();

  printReport();
  if (httpPostRequestResiduals.length > 0) {
    process.exitCode = 1;
  } else if (process.env.ALS_VERIFY_STRICT === "1" && footgunResiduals.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`verify-als-request-cleanup: fatal: ${message}\n`);
  process.exitCode = 1;
});
