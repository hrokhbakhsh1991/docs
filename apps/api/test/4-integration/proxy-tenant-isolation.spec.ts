/**
 * 4-integration — outbound tenant HTTP proxy isolation (mock map upstream).
 *
 * Simulates an external map/geocode API via {@link TenantHttpProxy}:
 * - Asserts `x-tenant-id` is injected on every outbound request from ALS
 * - Asserts per-tenant GET cache never returns Tenant A body to Tenant B
 *
 * No Postgres or real map API — STORAGE_DRIVER=memory, in-process mock HTTP only.
 *
 * @see docs/phase-5/appendices/tenant-http-proxy.md
 * @see apps/api/test/0-functional/async-propagation.spec.ts — MockExternalEnrichmentApi pattern
 */
import assert from "node:assert/strict";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { after, before, describe, it } from "node:test";

import { TENANT_PROXY_OUTBOUND_HEADER, TenantHttpProxy } from "../../src/proxy/tenant-http-proxy";
import { runWithTenantContext } from "../../src/tenant/tenant-request-context";
import { integrationTenantId } from "../test-helpers";

type CapturedUpstreamRequest = {
  readonly method: string | undefined;
  readonly path: string | undefined;
  readonly tenantHeader: string | undefined;
};

type MapUpstreamBody = {
  readonly tenantId: string;
  readonly payload: string;
};

function readHeader(headers: IncomingMessage["headers"], name: string): string | undefined {
  const raw = headers[name];
  if (raw === undefined) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

function startMockMapUpstream(): Promise<{
  readonly baseUrl: string;
  readonly captured: CapturedUpstreamRequest[];
  close: () => Promise<void>;
}> {
  const captured: CapturedUpstreamRequest[] = [];

  const server = http.createServer((req, res) => {
    const tenantHeader = readHeader(req.headers, TENANT_PROXY_OUTBOUND_HEADER);
    captured.push({
      method: req.method,
      path: req.url,
      tenantHeader,
    });

    const body: MapUpstreamBody = {
      tenantId: tenantHeader ?? "missing",
      payload: `map-tile-${tenantHeader ?? "none"}`,
    };
    res.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "private, max-age=60",
    });
    res.end(JSON.stringify(body));
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("mock map upstream: invalid listen address"));
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

async function readMapBody(response: Response): Promise<MapUpstreamBody> {
  const parsed = (await response.json()) as MapUpstreamBody;
  assert.equal(typeof parsed.tenantId, "string");
  assert.equal(typeof parsed.payload, "string");
  return parsed;
}

describe("4-integration — proxy tenant isolation (mock map upstream)", () => {
  const tenantA = integrationTenantId();
  const tenantB = integrationTenantId();
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  let upstream: Awaited<ReturnType<typeof startMockMapUpstream>>;
  let proxy: TenantHttpProxy;

  before(async () => {
    process.env.STORAGE_DRIVER = "memory";
    upstream = await startMockMapUpstream();
    proxy = new TenantHttpProxy({
      upstreamBaseUrl: upstream.baseUrl,
      cacheResponses: true,
    });
  });

  after(async () => {
    await upstream.close();
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
  });

  it("injects x-tenant-id on outbound proxy requests per ALS-bound tenant", async () => {
    const path = "/v1/geocode?place=paris";

    const bodyA = await runWithTenantContext(tenantA, async () => {
      const res = await proxy.fetch(path);
      assert.equal(res.headers.get("x-proxy-cache"), "MISS");
      return readMapBody(res);
    });

    const bodyB = await runWithTenantContext(tenantB, async () => {
      const res = await proxy.fetch(path);
      assert.equal(res.headers.get("x-proxy-cache"), "MISS");
      return readMapBody(res);
    });

    assert.equal(bodyA.tenantId, tenantA);
    assert.equal(bodyB.tenantId, tenantB);
    assert.notEqual(bodyA.payload, bodyB.payload);

    assert.equal(upstream.captured.length, 2);
    assert.equal(upstream.captured[0]?.tenantHeader, tenantA);
    assert.equal(upstream.captured[1]?.tenantHeader, tenantB);
    assert.equal(upstream.captured[0]?.method, "GET");
    assert.equal(upstream.captured[1]?.method, "GET");
  });

  it("does not serve Tenant A cached GET body to Tenant B on the same path", async () => {
    const path = "/v1/geocode?place=rome";
    const callsBefore = upstream.captured.length;

    const firstA = await runWithTenantContext(tenantA, async () => {
      const res = await proxy.fetch(path);
      assert.equal(res.headers.get("x-proxy-cache"), "MISS");
      return readMapBody(res);
    });

    const cachedA = await runWithTenantContext(tenantA, async () => {
      const res = await proxy.fetch(path);
      assert.equal(res.headers.get("x-proxy-cache"), "HIT");
      return readMapBody(res);
    });

    assert.deepEqual(cachedA, firstA);
    assert.equal(
      upstream.captured.length,
      callsBefore + 1,
      "second GET for same tenant must hit proxy cache, not upstream"
    );

    const bodyB = await runWithTenantContext(tenantB, async () => {
      const res = await proxy.fetch(path);
      assert.equal(res.headers.get("x-proxy-cache"), "MISS");
      return readMapBody(res);
    });

    assert.equal(bodyB.tenantId, tenantB);
    assert.notEqual(bodyB.payload, firstA.payload);
    assert.equal(
      upstream.captured.length,
      callsBefore + 2,
      "Tenant B must trigger a fresh upstream call (no A cache bleed)"
    );
    assert.equal(upstream.captured.at(-1)?.tenantHeader, tenantB);
  });

  it("isolates parallel proxy fetches under mixed tenants", async () => {
    proxy.clearCache();
    const pathA = "/v1/geocode?place=berlin";
    const pathB = "/v1/geocode?place=madrid";
    const callsBefore = upstream.captured.length;

    const [resultA, resultB] = await Promise.all([
      runWithTenantContext(tenantA, () => proxy.fetch(pathA).then(readMapBody)),
      runWithTenantContext(tenantB, () => proxy.fetch(pathB).then(readMapBody)),
    ]);

    assert.equal(resultA.tenantId, tenantA);
    assert.equal(resultB.tenantId, tenantB);

    const newCaptures = upstream.captured.slice(callsBefore);
    assert.equal(newCaptures.length, 2);
    const outboundTenants = new Set(
      newCaptures.map((c) => c.tenantHeader).filter((t): t is string => t !== undefined)
    );
    assert.ok(outboundTenants.has(tenantA));
    assert.ok(outboundTenants.has(tenantB));
  });
});
