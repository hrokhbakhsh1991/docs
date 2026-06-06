import assert from "node:assert/strict";
import http from "node:http";
import { describe, it, before, after } from "node:test";

import { createRequestListener } from "../src/app";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
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

describe("MAP 5.2 — validate via plugin before persist", () => {
  const store = new InMemoryTourRepository();
  let listener: ReturnType<typeof createRequestListener>;
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    listener = createRequestListener({
      toursService: createTestToursService(store),
    });
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
  });

  it("rejects plugin-invalid canonical with 400 before any tour row is stored", async () => {
    const beforeCount = (await store.listByTenant("tenant-a")).length;

    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: authHeaders("tenant-a"),
      body: {
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: {
          basics: {},
          details: { summary: "ok" },
        },
      },
    });

    assert.equal(res.status, 400);
    assert.match((res.body as { error?: string }).error ?? "", /CANONICAL_VALIDATION_FAILED/);

    const afterCount = (await store.listByTenant("tenant-a")).length;
    assert.equal(afterCount, beforeCount, "persist must not run when validation fails");
  });

  it("persists valid canonical after plugin validation passes", async () => {
    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: authHeaders("tenant-a"),
      body: {
        data: {
          basics: { title: "Validated persist" },
          details: { summary: "ok" },
        },
      },
    });

    assert.equal(res.status, 201);
    const rows = await store.listByTenant("tenant-a");
    assert.ok(rows.some((t) => t.canonical.data?.basics?.title === "Validated persist"));
  });
});
