/**
 * GET /tours — tenant-scoped list with cursor pagination (memory driver).
 *
 * @see docs/phase-5/appendices/tours-list-endpoint.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { createTestToursService, integrationTenantId } from "../test-helpers";

type ListResponse = {
  readonly items?: Array<{
    readonly id: string;
    readonly tenantId: string;
    readonly createdAt: string;
    readonly rowVersion: number;
    readonly canonical?: unknown;
  }>;
  readonly nextCursor?: string | null;
  readonly error?: string;
};

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "tours-list-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-tours-list",
  };
}

async function httpJson(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  options: { readonly method: "GET" | "POST"; readonly path: string; readonly body?: unknown }
): Promise<{ status: number; body: ListResponse & { id?: string; tenantId?: string } }> {
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
            ...authHeaders(tenantId),
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
              body: raw.length > 0 ? JSON.parse(raw) : {},
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

describe("1-functional — GET /tours list (memory driver)", () => {
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

  it("LIST-01: empty tenant returns empty items", async () => {
    const tenantId = integrationTenantId();
    const listener = createRequestListener({ toursService: createTestToursService() });

    const list = await httpJson(listener, tenantId, { method: "GET", path: "/tours" });
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.items, []);
    assert.equal(list.body.nextCursor, null);
  });

  it("LIST-02: returns slim rows without canonical", async () => {
    const tenantId = integrationTenantId();
    const listener = createRequestListener({ toursService: createTestToursService() });

    const created = await httpJson(listener, tenantId, {
      method: "POST",
      path: "/tours",
      body: { data: { basics: { title: "list-row" }, details: { summary: "ok" } } },
    });
    assert.equal(created.status, 201);
    assert.ok(created.body.id);

    const list = await httpJson(listener, tenantId, { method: "GET", path: "/tours" });
    assert.equal(list.status, 200);
    assert.equal(list.body.items?.length, 1);
    const row = list.body.items![0]!;
    assert.equal(row.id, created.body.id);
    assert.equal(row.tenantId, tenantId);
    assert.ok(row.createdAt);
    assert.equal(row.rowVersion, 1);
    assert.equal("canonical" in row, false);
  });

  it("LIST-03: cursor pagination returns next page", async () => {
    const tenantId = integrationTenantId();
    const listener = createRequestListener({ toursService: createTestToursService() });
    const ids: string[] = [];

    for (let i = 0; i < 3; i += 1) {
      const created = await httpJson(listener, tenantId, {
        method: "POST",
        path: "/tours",
        body: {
          data: { basics: { title: `page-${i}` }, details: { summary: String(i) } },
        },
      });
      assert.equal(created.status, 201);
      ids.push(created.body.id!);
    }

    const page1 = await httpJson(listener, tenantId, {
      method: "GET",
      path: "/tours?limit=2",
    });
    assert.equal(page1.status, 200);
    assert.equal(page1.body.items?.length, 2);
    assert.equal(page1.body.nextCursor, page1.body.items![1]!.id);

    const page2 = await httpJson(listener, tenantId, {
      method: "GET",
      path: `/tours?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor!)}`,
    });
    assert.equal(page2.status, 200);
    assert.equal(page2.body.items?.length, 1);
    assert.equal(page2.body.items![0]!.id, ids[2]);
    assert.equal(page2.body.nextCursor, null);
  });

  it("LIST-04: tenant B does not see tenant A tours", async () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const listener = createRequestListener({ toursService: createTestToursService() });

    await httpJson(listener, tenantA, {
      method: "POST",
      path: "/tours",
      body: { data: { basics: { title: "a-only" }, details: { summary: "a" } } },
    });

    const listB = await httpJson(listener, tenantB, { method: "GET", path: "/tours" });
    assert.equal(listB.status, 200);
    assert.deepEqual(listB.body.items, []);
  });
});
