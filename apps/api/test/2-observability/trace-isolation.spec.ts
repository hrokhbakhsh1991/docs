/**
 * 2-observability — trace id isolation through HTTP → service → repository.
 *
 * Chain under test:
 *   HTTP handler → Service → Repository → (optional) Postgres via withTenantRls
 *
 * At every layer we snapshot {@link getActiveTraceId} to prove the trace id bound
 * from ingress headers survives nested async hops. Concurrent tenant A vs tenant B
 * requests must never cross-bind trace ids.
 *
 * Memory mode (default): ALS propagation only — no Postgres required.
 * Postgres mode: when DATABASE_URL is set, asserts `app.current_trace_id` GUC on the
 * same connection as RLS queries.
 *
 * Run (memory):
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/2-observability/trace-isolation.spec.ts
 *
 * Run (Postgres GUC):
 *   DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
 *     NODE_ENV=test STORAGE_DRIVER=prisma node --import tsx --test test/2-observability/trace-isolation.spec.ts
 *
 * @see docs/phase-5/appendices/trace-request-context.md
 * @see apps/api/test/0-functional/async-propagation.spec.ts — tenant ALS chain pattern
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { after, before, describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { disconnectPrisma } from "../../src/db/prisma";
import { withTenantRls } from "../../src/db/with-tenant-rls";
import { readJsonBody, sendJson } from "../../src/http/json";
import { resolveTraceIdFromHeaders } from "../../src/observability/resolve-trace-id";
import {
  getActiveTraceId,
  requireActiveTraceId,
  runWithTraceContext,
} from "../../src/observability/trace-request-context";
import { InMemoryTourRepository } from "../../src/storage/in-memory-tour.repository";
import { resolveTenantContextFromRequest } from "../../src/tenant-kernel/tenant-kernel";
import { getActiveTenantId, runWithTenantContext } from "../../src/tenant/tenant-request-context";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

type TracePhase =
  | "http-handler-entry"
  | "http-after-setImmediate"
  | "service-entry"
  | "service-after-nested-await"
  | "repo-before-query"
  | "repo-during-query"
  | "repo-after-query"
  | "service-return"
  | "http-handler-return";

type TraceSnapshot = {
  readonly phase: TracePhase;
  readonly alsTraceId: string | undefined;
  readonly requiredTraceId: string;
  readonly pgTraceId?: string | null;
  readonly tenantId?: string;
};

type DbQueryCapture = {
  readonly tenantId: string;
  readonly expectedTraceId: string;
  readonly pgTraceId: string | null;
  readonly alsTraceId: string | undefined;
};

function delayViaSetImmediate(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function delayViaSetTimeoutZero(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function captureTraceSnapshot(
  phase: TracePhase,
  extras?: Pick<TraceSnapshot, "pgTraceId" | "tenantId">
): TraceSnapshot {
  return {
    phase,
    alsTraceId: getActiveTraceId(),
    requiredTraceId: requireActiveTraceId(),
    ...extras,
  };
}

function assertSnapshotMatches(snap: TraceSnapshot, expectedTraceId: string): void {
  assert.equal(
    snap.alsTraceId,
    expectedTraceId,
    `${snap.phase}: getActiveTraceId() must match bound trace (got ${snap.alsTraceId ?? "undefined"})`
  );
  assert.equal(
    snap.requiredTraceId,
    expectedTraceId,
    `${snap.phase}: requireActiveTraceId() must match bound trace (got ${snap.requiredTraceId})`
  );
  if (snap.pgTraceId !== undefined) {
    assert.equal(
      snap.pgTraceId,
      expectedTraceId,
      `${snap.phase}: Postgres app.current_trace_id must match ALS trace`
    );
  }
}

function assertAllSnapshots(snapshots: readonly TraceSnapshot[], expectedTraceId: string): void {
  assert.ok(snapshots.length > 0, "expected at least one trace snapshot");
  for (const snap of snapshots) {
    assertSnapshotMatches(snap, expectedTraceId);
  }
}

function assertNoCrossTraceContamination(
  snapshots: readonly TraceSnapshot[],
  ownTraceId: string,
  otherTraceId: string
): void {
  for (const snap of snapshots) {
    assert.notEqual(
      snap.alsTraceId,
      otherTraceId,
      `${snap.phase}: must not carry concurrent request trace ${otherTraceId}`
    );
    assert.equal(snap.alsTraceId, ownTraceId, `${snap.phase}: trace mismatch`);
    if (snap.pgTraceId !== undefined && snap.pgTraceId !== null) {
      assert.notEqual(
        snap.pgTraceId,
        otherTraceId,
        `${snap.phase}: Postgres GUC must not carry concurrent trace ${otherTraceId}`
      );
    }
  }
}

async function readPgTraceSetting(
  tenantId: string
): Promise<{ pgTraceId: string | null; tourCount: number }> {
  return withTenantRls(tenantId, async (tx) => {
    const rows = await tx.$queryRaw<Array<{ trace_id: string | null }>>`
      SELECT current_setting('app.current_trace_id', true) AS trace_id
    `;
    const pgTraceId = rows[0]?.trace_id ?? null;
    const tourCount = await tx.tour.count({ where: { tenantId } });
    return { pgTraceId, tourCount };
  });
}

/** Repository — probes ALS before/after optional Postgres query. */
class TraceProbeRepository {
  constructor(
    private readonly store: InMemoryTourRepository,
    private readonly usePostgres: boolean,
    private readonly dbCaptures: DbQueryCapture[]
  ) {}

  async listToursWithTraceProbe(
    tenantId: string,
    expectedTraceId: string,
    snapshots: TraceSnapshot[]
  ): Promise<number> {
    await delayViaSetImmediate();
    snapshots.push(captureTraceSnapshot("repo-before-query", { tenantId }));

    if (this.usePostgres) {
      snapshots.push(
        captureTraceSnapshot("repo-during-query", {
          tenantId,
          ...(await this.probePostgresTrace(tenantId, expectedTraceId)),
        })
      );
    } else {
      snapshots.push(captureTraceSnapshot("repo-during-query", { tenantId }));
    }

    await delayViaSetTimeoutZero();
    snapshots.push(captureTraceSnapshot("repo-after-query", { tenantId }));

    const tours = await this.store.listByTenant(tenantId);
    return tours.length;
  }

  private async probePostgresTrace(
    tenantId: string,
    expectedTraceId: string
  ): Promise<{ pgTraceId: string | null }> {
    const alsTraceId = getActiveTraceId();
    const { pgTraceId } = await readPgTraceSetting(tenantId);
    this.dbCaptures.push({
      tenantId,
      expectedTraceId,
      pgTraceId,
      alsTraceId,
    });
    return { pgTraceId };
  }
}

/** Application service — nested awaits between handler and repository. */
class TraceProbeService {
  constructor(private readonly repository: TraceProbeRepository) {}

  async probeTraceChain(
    auth: TenantAuthContext,
    expectedTraceId: string,
    snapshots: TraceSnapshot[]
  ): Promise<{ tourCount: number }> {
    await Promise.resolve();
    snapshots.push(captureTraceSnapshot("service-entry", { tenantId: auth.tenantId }));

    await (async () => {
      await delayViaSetImmediate();
      await delayViaSetTimeoutZero();
    })();

    snapshots.push(captureTraceSnapshot("service-after-nested-await", { tenantId: auth.tenantId }));

    const tourCount = await this.repository.listToursWithTraceProbe(
      auth.tenantId,
      expectedTraceId,
      snapshots
    );

    snapshots.push(captureTraceSnapshot("service-return", { tenantId: auth.tenantId }));
    return { tourCount };
  }
}

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "trace-isolation-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-trace-isolation",
  };
}

type ProbeRouteDeps = {
  readonly service: TraceProbeService;
};

/**
 * HTTP handler — resolves trace + tenant from headers, binds nested ALS contexts
 * the same way production middleware should (trace outer, tenant inner).
 */
async function handleTraceProbe(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ProbeRouteDeps
): Promise<void> {
  const snapshots: TraceSnapshot[] = [];

  try {
    await readJsonBody<unknown>(req);
    const auth = await resolveTenantContextFromRequest(req);
    const traceId = resolveTraceIdFromHeaders(req.headers);

    await runWithTraceContext(traceId, async () =>
      runWithTenantContext(
        auth.tenantId,
        async () => {
          snapshots.push(captureTraceSnapshot("http-handler-entry", { tenantId: auth.tenantId }));

          await delayViaSetImmediate();
          snapshots.push(
            captureTraceSnapshot("http-after-setImmediate", { tenantId: auth.tenantId })
          );

          const result = await deps.service.probeTraceChain(auth, traceId, snapshots);

          snapshots.push(captureTraceSnapshot("http-handler-return", { tenantId: auth.tenantId }));

          sendJson(res, 200, {
            tenantId: auth.tenantId,
            traceId,
            tourCount: result.tourCount,
            snapshots,
          });
        },
        { actorId: auth.userId, workspaceType: "starter" }
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    sendJson(res, 500, { error: message, snapshots });
  }
}

function createProbeListener(deps: ProbeRouteDeps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if ((req.method ?? "GET") === "POST" && url.pathname === "/probe/trace-context") {
      await handleTraceProbe(req, res, deps);
      return;
    }
    res.statusCode = 404;
    res.end();
  };
}

async function postTraceProbe(
  listener: ReturnType<typeof createProbeListener>,
  tenantId: string,
  traceId: string
): Promise<{
  status: number;
  body: {
    tenantId?: string;
    traceId?: string;
    tourCount?: number;
    snapshots?: TraceSnapshot[];
    error?: string;
  };
}> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = JSON.stringify({});
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/probe/trace-context",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(payload)),
            "x-trace-id": traceId,
            ...authHeaders(tenantId),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? JSON.parse(raw) : {},
            });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      req.write(payload);
      req.end();
    });
  });
}

const REQUIRED_PHASES: readonly TracePhase[] = [
  "http-handler-entry",
  "http-after-setImmediate",
  "service-entry",
  "service-after-nested-await",
  "repo-before-query",
  "repo-during-query",
  "repo-after-query",
  "service-return",
  "http-handler-return",
];

describe("2-observability — trace id isolation (HTTP → service → repository)", () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const dbCaptures: DbQueryCapture[] = [];

  let listener: ReturnType<typeof createProbeListener>;

  before(async () => {
    if (hasDatabase) {
      process.env.STORAGE_DRIVER = "prisma";
      await disconnectPrisma();
    } else {
      process.env.STORAGE_DRIVER = "memory";
    }

    const store = new InMemoryTourRepository();
    const repository = new TraceProbeRepository(store, hasDatabase, dbCaptures);
    const service = new TraceProbeService(repository);
    listener = createProbeListener({ service });
  });

  after(async () => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
    if (hasDatabase) {
      await disconnectPrisma();
    }
  });

  it("TRACE-ISO-1: trace id survives HTTP → service → repo chain", async () => {
    const tenantId = integrationTenantId();
    const traceId = randomUUID();

    const { status, body } = await postTraceProbe(listener, tenantId, traceId);

    assert.equal(status, 200, `probe must succeed (body=${JSON.stringify(body)})`);
    assert.equal(body.tenantId, tenantId);
    assert.equal(body.traceId, traceId);
    assert.ok(Array.isArray(body.snapshots), "response must include snapshots");

    const snapshots = body.snapshots!;
    assert.equal(
      snapshots.length,
      REQUIRED_PHASES.length,
      `expected ${REQUIRED_PHASES.length} phase snapshots`
    );

    for (let i = 0; i < REQUIRED_PHASES.length; i += 1) {
      assert.equal(
        snapshots[i]!.phase,
        REQUIRED_PHASES[i],
        `snapshot order mismatch at index ${i}`
      );
    }

    assertAllSnapshots(snapshots, traceId);

    assert.equal(
      getActiveTraceId(),
      undefined,
      "trace ALS must be cleared after HTTP handler completes"
    );
    assert.equal(
      getActiveTenantId(),
      undefined,
      "tenant ALS must be cleared after HTTP handler completes"
    );
  });

  it("TRACE-ISO-2: concurrent tenant A vs B requests never cross-bind trace ids", async () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const traceA = randomUUID();
    const traceB = randomUUID();

    assert.notEqual(tenantA, tenantB);
    assert.notEqual(traceA, traceB);

    const capturesBefore = dbCaptures.length;

    const [resultA, resultB] = await Promise.all([
      postTraceProbe(listener, tenantA, traceA),
      postTraceProbe(listener, tenantB, traceB),
    ]);

    assert.equal(resultA.status, 200);
    assert.equal(resultB.status, 200);
    assert.equal(resultA.body.traceId, traceA);
    assert.equal(resultB.body.traceId, traceB);

    assertAllSnapshots(resultA.body.snapshots ?? [], traceA);
    assertAllSnapshots(resultB.body.snapshots ?? [], traceB);

    assertNoCrossTraceContamination(resultA.body.snapshots ?? [], traceA, traceB);
    assertNoCrossTraceContamination(resultB.body.snapshots ?? [], traceB, traceA);

    if (hasDatabase) {
      const newCaptures = dbCaptures.slice(capturesBefore);
      assert.ok(newCaptures.length >= 2, "expected Postgres trace captures for both tenants");

      const captureA = newCaptures.find((c) => c.tenantId === tenantA);
      const captureB = newCaptures.find((c) => c.tenantId === tenantB);
      assert.ok(captureA, "missing Postgres capture for tenant A");
      assert.ok(captureB, "missing Postgres capture for tenant B");

      assert.equal(captureA!.pgTraceId, traceA);
      assert.equal(captureB!.pgTraceId, traceB);
      assert.notEqual(captureA!.pgTraceId, traceB!.pgTraceId);
    }

    assert.equal(getActiveTraceId(), undefined);
    assert.equal(getActiveTenantId(), undefined);
  });

  it("TRACE-ISO-3: x-request-id header is accepted when x-trace-id is absent", async () => {
    const tenantId = integrationTenantId();
    const requestId = randomUUID();

    const { status, body } = await new Promise<{
      status: number;
      body: { traceId?: string; snapshots?: TraceSnapshot[]; error?: string };
    }>((resolve, reject) => {
      const server = http.createServer(listener);
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          server.close();
          reject(new Error("no listen address"));
          return;
        }
        const payload = JSON.stringify({});
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: addr.port,
            path: "/probe/trace-context",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": String(Buffer.byteLength(payload)),
              "x-request-id": requestId,
              ...authHeaders(tenantId),
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => {
              server.close();
              const raw = Buffer.concat(chunks).toString("utf8");
              resolve({
                status: res.statusCode ?? 0,
                body: raw.length > 0 ? JSON.parse(raw) : {},
              });
            });
          }
        );
        req.on("error", (err) => {
          server.close();
          reject(err);
        });
        req.write(payload);
        req.end();
      });
    });

    assert.equal(status, 200, `probe must succeed (body=${JSON.stringify(body)})`);
    assert.equal(body.traceId, requestId);
    assertAllSnapshots(body.snapshots ?? [], requestId);
  });
});
