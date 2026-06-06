/**
 * Phase 1 P2 #10 — memory driver concurrent mixed-tenant HTTP isolation.
 *
 * Proves POST/GET /tours via createRequestListener + STORAGE_DRIVER=memory
 * never returns another tenant's tour body under concurrent A/B load.
 *
 * Run:
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test \
 *     test/1-integration/memory-mixed-tenant-http.spec.ts
 *
 * @see DEC-042 · apps/api/docs/phase1-aggressive-audit.md DI deferred #10
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { createTestToursService, integrationTenantId } from "../test-helpers";

const CONCURRENT_ROUNDS = 24;

type TourResponse = {
  readonly id?: string;
  readonly tenantId?: string;
  readonly error?: string;
  readonly code?: string;
};

function authHeaders(tenantId: string, userSuffix: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": `memory-mixed-${userSuffix}`,
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-memory-mixed",
  };
}

async function requestTour(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  options: {
    readonly method: "GET" | "POST";
    readonly path: string;
    readonly body?: unknown;
  }
): Promise<{ status: number; body: TourResponse }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: options.path,
          method: options.method,
          headers: {
            "Content-Type": "application/json",
            ...(payload ? { "Content-Length": String(Buffer.byteLength(payload)) } : {}),
            ...authHeaders(tenantId, tenantId.slice(0, 8)),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? (JSON.parse(raw) as TourResponse) : {},
            });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  });
}

describe("1-integration — memory mixed-tenant HTTP isolation (DEC-042)", () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorOutboxRelay = process.env.OUTBOX_RELAY_ENABLED;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    process.env.OUTBOX_RELAY_ENABLED = "false";
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
    if (priorOutboxRelay === undefined) {
      delete process.env.OUTBOX_RELAY_ENABLED;
    } else {
      process.env.OUTBOX_RELAY_ENABLED = priorOutboxRelay;
    }
  });

  it("MEM-HTTP-01: cross-tenant GET returns 404 on memory driver", async () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const listener = createRequestListener({ toursService: createTestToursService() });

    const created = await requestTour(listener, tenantA, {
      method: "POST",
      path: "/tours",
      body: {
        data: { basics: { title: "tenant-a-tour" }, details: { summary: "a" } },
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.tenantId, tenantA);
    assert.ok(created.body.id);

    const cross = await requestTour(listener, tenantB, {
      method: "GET",
      path: `/tours/${created.body.id}`,
    });
    assert.equal(cross.status, 404, "tenant B must not read tenant A tour on memory driver");
  });

  it("MEM-HTTP-02: concurrent mixed-tenant POST+GET never cross-leaks bodies", async () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const listener = createRequestListener({ toursService: createTestToursService() });

    const createA = await requestTour(listener, tenantA, {
      method: "POST",
      path: "/tours",
      body: {
        data: { basics: { title: "mixed-a" }, details: { summary: "a" } },
      },
    });
    const createB = await requestTour(listener, tenantB, {
      method: "POST",
      path: "/tours",
      body: {
        data: { basics: { title: "mixed-b" }, details: { summary: "b" } },
      },
    });
    assert.equal(createA.status, 201);
    assert.equal(createB.status, 201);

    const tourAId = createA.body.id!;
    const tourBId = createB.body.id!;

    const tasks: Array<Promise<void>> = [];
    for (let round = 0; round < CONCURRENT_ROUNDS; round += 1) {
      tasks.push(
        (async () => {
          const ownA = await requestTour(listener, tenantA, {
            method: "GET",
            path: `/tours/${tourAId}`,
          });
          assert.equal(ownA.status, 200);
          assert.equal(ownA.body.tenantId, tenantA);

          const ownB = await requestTour(listener, tenantB, {
            method: "GET",
            path: `/tours/${tourBId}`,
          });
          assert.equal(ownB.status, 200);
          assert.equal(ownB.body.tenantId, tenantB);

          const leakAB = await requestTour(listener, tenantA, {
            method: "GET",
            path: `/tours/${tourBId}`,
          });
          assert.equal(leakAB.status, 404);

          const leakBA = await requestTour(listener, tenantB, {
            method: "GET",
            path: `/tours/${tourAId}`,
          });
          assert.equal(leakBA.status, 404);
        })()
      );
    }

    await Promise.all(tasks);
  });
});
