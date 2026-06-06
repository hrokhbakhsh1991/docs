/**
 * 0-functional — AsyncLocalStorage tenant propagation through a realistic call chain.
 *
 * Chain under test:
 *   HTTP handler → Service → Repository → mock external API (I/O delay) → Repository
 *
 * At every layer (including before/after mock API await) we snapshot
 * {@link getActiveTenantId} and {@link requireActiveTenantId} to prove deep nested
 * async + timer hops do not lose or misplace tenant context.
 *
 * No Postgres required — STORAGE_DRIVER=memory, in-process HTTP only.
 *
 * @see apps/api/test/0-security/async-context-leak.spec.ts — concurrent mixed-tenant ALS
 * @see docs/phase-5/audits/ALS-CONTEXT-SECURITY-REPORT.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { after, before, describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { readJsonBody, sendJson } from "../../src/http/json";
import { InMemoryTourRepository } from "../../src/storage/in-memory-tour.repository";
import { resolveTenantContextFromRequest } from "../../src/tenant-kernel/tenant-kernel";
import {
  getActiveTenantId,
  requireActiveTenantId,
  runWithTenantContext,
} from "../../src/tenant/tenant-request-context";
import { integrationTenantId } from "../test-helpers";

type PropagationPhase =
  | "http-handler-entry"
  | "http-after-setImmediate"
  | "http-after-setTimeout-0"
  | "service-entry"
  | "service-after-nested-await"
  | "repo-before-external-api"
  | "external-api-during-delay"
  | "external-api-after-delay"
  | "repo-after-external-api"
  | "service-return"
  | "http-handler-return";

type TenantSnapshot = {
  readonly phase: PropagationPhase;
  readonly alsTenant: string | undefined;
  readonly requiredTenant: string;
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

function delayViaPromiseTick(): Promise<void> {
  return Promise.resolve().then(() => undefined);
}

function captureSnapshot(phase: PropagationPhase): TenantSnapshot {
  return {
    phase,
    alsTenant: getActiveTenantId(),
    requiredTenant: requireActiveTenantId(),
  };
}

function assertSnapshotMatches(snap: TenantSnapshot, expectedTenant: string): void {
  assert.equal(
    snap.alsTenant,
    expectedTenant,
    `${snap.phase}: getActiveTenantId() must match bound tenant (got ${snap.alsTenant ?? "undefined"})`
  );
  assert.equal(
    snap.requiredTenant,
    expectedTenant,
    `${snap.phase}: requireActiveTenantId() must match bound tenant (got ${snap.requiredTenant})`
  );
}

function assertAllSnapshots(snapshots: readonly TenantSnapshot[], expectedTenant: string): void {
  assert.ok(snapshots.length > 0, "expected at least one tenant snapshot");
  for (const snap of snapshots) {
    assertSnapshotMatches(snap, expectedTenant);
  }
}

/** Simulated third-party HTTP / enrichment call with deliberate async gaps. */
class MockExternalEnrichmentApi {
  async enrichTenantMetadata(
    tenantId: string,
    snapshots: TenantSnapshot[]
  ): Promise<{ tenantId: string; enriched: true }> {
    await delayViaPromiseTick();
    snapshots.push(captureSnapshot("external-api-during-delay"));

    await delayViaSetImmediate();
    await delayViaSetTimeoutZero();

    snapshots.push(captureSnapshot("external-api-after-delay"));
    return { tenantId, enriched: true };
  }
}

/** Repository layer — probes ALS before and after the mock external API await. */
class PropagationProbeRepository {
  constructor(
    private readonly store: InMemoryTourRepository,
    private readonly externalApi: MockExternalEnrichmentApi
  ) {}

  async listToursWithEnrichment(tenantId: string, snapshots: TenantSnapshot[]): Promise<number> {
    await delayViaSetImmediate();
    snapshots.push(captureSnapshot("repo-before-external-api"));

    await this.externalApi.enrichTenantMetadata(tenantId, snapshots);

    await delayViaSetTimeoutZero();
    snapshots.push(captureSnapshot("repo-after-external-api"));

    const tours = await this.store.listByTenant(tenantId);
    return tours.length;
  }
}

/** Application service — nested awaits between handler and repository. */
class PropagationProbeService {
  constructor(private readonly repository: PropagationProbeRepository) {}

  async probeTenantChain(
    auth: TenantAuthContext,
    snapshots: TenantSnapshot[]
  ): Promise<{ tourCount: number }> {
    await delayViaPromiseTick();
    snapshots.push(captureSnapshot("service-entry"));

    await (async () => {
      await delayViaSetImmediate();
      await delayViaSetTimeoutZero();
    })();

    snapshots.push(captureSnapshot("service-after-nested-await"));

    const tourCount = await this.repository.listToursWithEnrichment(auth.tenantId, snapshots);

    snapshots.push(captureSnapshot("service-return"));
    return { tourCount };
  }
}

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "async-propagation-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-async-propagation",
  };
}

type ProbeRouteDeps = {
  readonly service: PropagationProbeService;
};

/**
 * Test HTTP handler — resolves tenant from headers (TenantKernel) then binds ALS
 * the same way {@link CanonicalTourService.writeTour} does at the service boundary.
 */
async function handlePropagationProbe(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ProbeRouteDeps
): Promise<void> {
  const snapshots: TenantSnapshot[] = [];

  try {
    await readJsonBody<unknown>(req);
    const auth = await resolveTenantContextFromRequest(req);

    await runWithTenantContext(
      auth.tenantId,
      async () => {
        snapshots.push(captureSnapshot("http-handler-entry"));

        await delayViaSetImmediate();
        snapshots.push(captureSnapshot("http-after-setImmediate"));

        await delayViaSetTimeoutZero();
        snapshots.push(captureSnapshot("http-after-setTimeout-0"));

        const result = await deps.service.probeTenantChain(auth, snapshots);

        snapshots.push(captureSnapshot("http-handler-return"));

        sendJson(res, 200, {
          tenantId: auth.tenantId,
          tourCount: result.tourCount,
          snapshots,
        });
      },
      { actorId: auth.userId, workspaceType: "starter" }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    sendJson(res, 500, { error: message, snapshots });
  }
}

function createProbeListener(deps: ProbeRouteDeps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if ((req.method ?? "GET") === "POST" && url.pathname === "/probe/tenant-context") {
      await handlePropagationProbe(req, res, deps);
      return;
    }
    res.statusCode = 404;
    res.end();
  };
}

async function postPropagationProbe(
  listener: ReturnType<typeof createProbeListener>,
  tenantId: string
): Promise<{
  status: number;
  body: {
    tenantId?: string;
    tourCount?: number;
    snapshots?: TenantSnapshot[];
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
          path: "/probe/tenant-context",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(payload)),
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

const REQUIRED_PHASES: readonly PropagationPhase[] = [
  "http-handler-entry",
  "http-after-setImmediate",
  "http-after-setTimeout-0",
  "service-entry",
  "service-after-nested-await",
  "repo-before-external-api",
  "external-api-during-delay",
  "external-api-after-delay",
  "repo-after-external-api",
  "service-return",
  "http-handler-return",
];

describe("0-functional async tenant context propagation", () => {
  const tenantId = integrationTenantId();
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  let listener: ReturnType<typeof createProbeListener>;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    const store = new InMemoryTourRepository();
    const externalApi = new MockExternalEnrichmentApi();
    const repository = new PropagationProbeRepository(store, externalApi);
    const service = new PropagationProbeService(repository);
    listener = createProbeListener({ service });
  });

  after(() => {
    process.env.STORAGE_DRIVER = priorStorageDriver;
  });

  it("ALS-PROP-1: tenant id survives HTTP → service → repo → mock API chain", async () => {
    const { status, body } = await postPropagationProbe(listener, tenantId);

    assert.equal(status, 200, `probe must succeed (body=${JSON.stringify(body)})`);
    assert.equal(body.tenantId, tenantId);
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

    assertAllSnapshots(snapshots, tenantId);

    assert.equal(
      getActiveTenantId(),
      undefined,
      "ALS must be cleared after HTTP handler completes"
    );
  });

  it("ALS-PROP-2: concurrent probes for two tenants never cross-bind context", async () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();

    const [resultA, resultB] = await Promise.all([
      postPropagationProbe(listener, tenantA),
      postPropagationProbe(listener, tenantB),
    ]);

    assert.equal(resultA.status, 200);
    assert.equal(resultB.status, 200);

    assertAllSnapshots(resultA.body.snapshots ?? [], tenantA);
    assertAllSnapshots(resultB.body.snapshots ?? [], tenantB);

    assert.notEqual(tenantA, tenantB);
    assert.equal(getActiveTenantId(), undefined, "ALS cleared after concurrent probes");
  });

  it("ALS-PROP-3: in-process service chain without HTTP preserves tenant", async () => {
    const snapshots: TenantSnapshot[] = [];
    const store = new InMemoryTourRepository();
    const service = new PropagationProbeService(
      new PropagationProbeRepository(store, new MockExternalEnrichmentApi())
    );
    const auth: TenantAuthContext = {
      tenantId,
      userId: "direct-probe-user",
      role: "admin",
      membershipStatus: "ACTIVE",
      workspaceId: "ws-direct",
    };

    await runWithTenantContext(tenantId, async () => {
      snapshots.push(captureSnapshot("http-handler-entry"));
      await delayViaSetImmediate();
      await service.probeTenantChain(auth, snapshots);
      snapshots.push(captureSnapshot("http-handler-return"));
    });

    assertAllSnapshots(snapshots, tenantId);
    assert.equal(getActiveTenantId(), undefined);
  });
});
