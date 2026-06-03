import assert from "node:assert/strict";
import http from "node:http";
import { describe, it, before } from "node:test";

import { createRequestListener } from "../src/app";
import { createTestToursService } from "./test-helpers";

/**
 * Phase 3.2 integrity — cross-tenant forensic (P3-E-DB-01).
 * Policy: mismatched tenant claims or cross-tenant resource access MUST return 403, never 200/404.
 */

type JsonResponse = {
  readonly status: number;
  readonly body: unknown;
};

function memberHeaders(input: {
  readonly tenantId?: string;
  readonly authenticatedTenantId?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "x-user-id": "user-forensic",
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-1",
  };
  if (input.tenantId !== undefined) headers["x-tenant-id"] = input.tenantId;
  if (input.authenticatedTenantId !== undefined) {
    headers["x-authenticated-tenant-id"] = input.authenticatedTenantId;
  }
  return headers;
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  options: {
    readonly method: string;
    readonly path: string;
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
  },
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
        },
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

describe("cross-tenant forensic (integrity 3.2)", () => {
  let listener: ReturnType<typeof createRequestListener>;

  before(() => {
    listener = createRequestListener({
      toursService: createTestToursService(),
    });
  });

  it("GET foreign tour returns 403 Forbidden (not 404)", async () => {
    const created = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: memberHeaders({ authenticatedTenantId: "tenant-a", tenantId: "tenant-a" }),
      body: { data: { basics: { title: "Protected" }, details: { summary: "" } } },
    });
    assert.equal(created.status, 201);
    const tourId = (created.body as { id: string }).id;

    const probe = await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}`,
      headers: memberHeaders({ authenticatedTenantId: "tenant-b", tenantId: "tenant-b" }),
    });

    assert.equal(
      probe.status,
      403,
      `cross-tenant GET must be 403 (got ${probe.status}) — 404 leaks existence via enumeration gap`,
    );
    const err = (probe.body as { error?: string }).error ?? "";
    assert.match(err, /FORBIDDEN_TOUR_READ_CROSS_TENANT/);
  });

  it("FORENSIC POST: tenantId token ≠ authenticated context → 403 only (never 200/201/404)", async () => {
    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: memberHeaders({ authenticatedTenantId: "tenant-a", tenantId: "tenant-a" }),
      body: {
        tenantId: "tenant-b",
        data: { basics: { title: "Cross-tenant token spoof" }, details: { summary: "" } },
      },
    });

    assert.notEqual(res.status, 200, "cross-tenant POST must not succeed with 200");
    assert.notEqual(res.status, 201, "cross-tenant POST must not create resource (201)");
    assert.notEqual(
      res.status,
      404,
      "cross-tenant POST must not mask auth failure as 404 — reveals policy gap",
    );
    assert.equal(res.status, 403, "accessibleBy / tenant binding must fail closed with 403");
    assert.match((res.body as { error?: string }).error ?? "", /FORBIDDEN_TENANT_CLAIM_MISMATCH/);
  });

  it("POST with body tenantId mismatching authenticated tenant returns 403", async () => {
    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: memberHeaders({ authenticatedTenantId: "tenant-a", tenantId: "tenant-a" }),
      body: {
        tenantId: "tenant-b",
        data: { basics: { title: "Spoofed" }, details: { summary: "" } },
      },
    });
    assert.equal(res.status, 403);
    assert.match((res.body as { error?: string }).error ?? "", /FORBIDDEN_TENANT_CLAIM_MISMATCH/);
  });

  it("POST with x-tenant-id only (no x-authenticated-tenant-id) returns 401", async () => {
    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: memberHeaders({ tenantId: "tenant-a" }),
      body: { data: { basics: { title: "Unauthenticated spoof" }, details: { summary: "" } } },
    });
    assert.equal(res.status, 401);
    assert.match(
      (res.body as { error?: string }).error ?? "",
      /UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT/,
    );
  });

  it("POST with x-tenant-id spoofed against x-authenticated-tenant-id returns 403", async () => {
    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: memberHeaders({ authenticatedTenantId: "tenant-a", tenantId: "tenant-b" }),
      body: { data: { basics: { title: "Header spoof" }, details: { summary: "" } } },
    });
    assert.equal(res.status, 403);
    assert.match((res.body as { error?: string }).error ?? "", /FORBIDDEN_TENANT_CLAIM_MISMATCH/);
  });

  it("GET with header tenant claim mismatch returns 403 before storage", async () => {
    const created = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: memberHeaders({ authenticatedTenantId: "tenant-a", tenantId: "tenant-a" }),
      body: { data: { basics: { title: "Probe" }, details: { summary: "" } } },
    });
    const tourId = (created.body as { id: string }).id;

    const res = await requestJson(listener, {
      method: "GET",
      path: `/tours/${tourId}`,
      headers: memberHeaders({ authenticatedTenantId: "tenant-a", tenantId: "tenant-b" }),
    });
    assert.equal(res.status, 403);
    assert.match((res.body as { error?: string }).error ?? "", /FORBIDDEN_TENANT_CLAIM_MISMATCH/);
  });
});
