/**
 * 4-integration — TenantHttpProxy production wire via map enrich route (DEC-093).
 *
 * @see docs/phase-5/appendices/proxy-production-wire.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { MAP_UPSTREAM_NOT_CONFIGURED } from "../../src/routes/api-v2/map-enrich.routes";
import { TENANT_PROXY_OUTBOUND_HEADER, TenantHttpProxy } from "../../src/proxy/tenant-http-proxy";
import { createTestToursService, integrationTenantId } from "../test-helpers";

type CapturedRequest = {
  readonly tenantHeader: string | undefined;
  readonly path: string | undefined;
};

function readHeader(headers: IncomingMessage["headers"], name: string): string | undefined {
  const raw = headers[name];
  if (raw === undefined) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

function startMockUpstream(): Promise<{
  readonly baseUrl: string;
  readonly captured: CapturedRequest[];
  close: () => Promise<void>;
}> {
  const captured: CapturedRequest[] = [];
  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    captured.push({
      tenantHeader: readHeader(req.headers, TENANT_PROXY_OUTBOUND_HEADER),
      path: req.url,
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, path: req.url }));
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("mock upstream: invalid listen address"));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        captured,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((err) => (err ? closeReject(err) : closeResolve()));
          }),
      });
    });
  });
}

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "proxy-wire-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-proxy-wire",
  };
}

async function getMapEnrich(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  upstreamPath: string
): Promise<{ status: number; body: string; code?: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const path = `/api/v2/map/enrich?path=${encodeURIComponent(upstreamPath)}`;
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method: "GET",
          headers: authHeaders(tenantId),
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            let code: string | undefined;
            if (raw.startsWith("{")) {
              try {
                code = (JSON.parse(raw) as { code?: string }).code;
              } catch {
                code = undefined;
              }
            }
            resolve({ status: res.statusCode ?? 0, body: raw, code });
          });
        }
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      req.end();
    });
  });
}

describe("4-integration — proxy production wire (DEC-093)", () => {
  const tenantId = integrationTenantId();
  let upstream: Awaited<ReturnType<typeof startMockUpstream>>;

  before(async () => {
    upstream = await startMockUpstream();
  });

  after(async () => {
    await upstream.close();
  });

  it("returns 503 MAP_UPSTREAM_NOT_CONFIGURED when proxy not injected", async () => {
    const listener = createRequestListener({ toursService: createTestToursService() });
    const res = await getMapEnrich(listener, tenantId, "/geocode?q=test");
    assert.equal(res.status, 503);
    assert.equal(res.code, MAP_UPSTREAM_NOT_CONFIGURED);
  });

  it("proxies GET with ALS x-tenant-id via production route", async () => {
    const proxy = new TenantHttpProxy({
      upstreamBaseUrl: upstream.baseUrl,
      cacheResponses: true,
      egressGuard: false,
    });
    const listener = createRequestListener({
      toursService: createTestToursService(),
      tenantHttpProxy: proxy,
    });

    const res = await getMapEnrich(listener, tenantId, "/geocode?q=wire-test");
    assert.equal(res.status, 200);
    assert.ok(res.body.includes("wire-test"));

    assert.equal(upstream.captured.length, 1);
    assert.equal(upstream.captured[0]?.tenantHeader, tenantId);
    assert.equal(upstream.captured[0]?.path, "/geocode?q=wire-test");
  });
});
