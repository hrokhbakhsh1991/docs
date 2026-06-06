import assert from "node:assert/strict";
import http from "node:http";
import { describe, it, before, after } from "node:test";

import { createRequestListener } from "../src/app";
import { createTestToursService } from "./test-helpers";

type JsonResponse = {
  readonly status: number;
  readonly body: unknown;
};

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "user-1",
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-1",
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  options: {
    readonly method: string;
    readonly path: string;
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
  }
): Promise<JsonResponse> {
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
            ...options.headers,
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
              body: raw.length > 0 ? JSON.parse(raw) : null,
            });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

describe("apps/api integration", { concurrency: false }, () => {
  let listener: ReturnType<typeof createRequestListener>;
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    listener = createRequestListener({
      toursService: createTestToursService(),
    });
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
  });

  it("GET /health returns 200", async () => {
    const res = await requestJson(listener, { method: "GET", path: "/health" });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: "ok", service: "@apps/api" });
  });

  it("POST /tours persists canonical document for tenant", async () => {
    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: authHeaders("tenant-a"),
      body: {
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: {
          basics: { title: "Alpine trek" },
          details: { summary: "High altitude" },
        },
      },
    });
    assert.equal(res.status, 201);
    const body = res.body as { id: string; tenantId: string };
    assert.equal(body.tenantId, "tenant-a");
    assert.ok(body.id.length > 0);
  });

  it("POST rejects invalid payload with Zod 400", async () => {
    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: authHeaders("tenant-a"),
      body: { schemaVersion: "not-a-number", data: { basics: { title: "x" } } },
    });
    assert.equal(res.status, 400);
    assert.match((res.body as { error?: string }).error ?? "", /ZOD_VALIDATION_FAILED/);
  });

  it("tenant B cannot read tenant A tour — returns 404 Not Found", async () => {
    const created = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: authHeaders("tenant-a"),
      body: {
        data: { basics: { title: "Secret tour" }, details: { summary: "" } },
      },
    });
    const tourId = (created.body as { id: string }).id;

    const foreign = await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}`,
      headers: authHeaders("tenant-b"),
    });
    assert.equal(foreign.status, 404);
    assert.match((foreign.body as { error?: string }).error ?? "", /not_found|TOUR_NOT_FOUND/);
  });
});
