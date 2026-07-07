/**
 * 4-integration — proxy upstream timeout + circuit breaker (DEC-075 / PI-01).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { ProxyCircuitOpenError } from "../../src/proxy/proxy-upstream-circuit";
import { ProxyUpstreamTimeoutError } from "../../src/proxy/proxy-upstream-timeout";
import { TenantHttpProxy } from "../../src/proxy/tenant-http-proxy";
import { runWithTenantContext } from "../../src/tenant/tenant-request-context";
import { integrationTenantId } from "../test-helpers";

function startHungUpstream(): Promise<{
  readonly baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = http.createServer(() => {
    // Intentionally never respond — exercises AbortSignal.timeout.
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("hung upstream: invalid listen address"));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((err) => (err ? closeReject(err) : closeResolve()));
          }),
      });
    });
  });
}

function startStatusUpstream(statusCode: number): Promise<{
  readonly baseUrl: string;
  readonly requestCount: () => number;
  close: () => Promise<void>;
}> {
  let count = 0;
  const server = http.createServer((_req, res) => {
    count += 1;
    res.writeHead(statusCode, { "content-type": "text/plain" });
    res.end("upstream-error");
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("status upstream: invalid listen address"));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        requestCount: () => count,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((err) => (err ? closeReject(err) : closeResolve()));
          }),
      });
    });
  });
}

describe("4-integration — proxy upstream timeout + circuit breaker (DEC-075)", () => {
  const tenantId = integrationTenantId();
  const prevTimeout = process.env.PROXY_UPSTREAM_TIMEOUT_MS;
  const prevThreshold = process.env.PROXY_CIRCUIT_FAILURE_THRESHOLD;
  const prevOpenMs = process.env.PROXY_CIRCUIT_OPEN_MS;

  before(() => {
    process.env.PROXY_UPSTREAM_TIMEOUT_MS = "300";
    process.env.PROXY_CIRCUIT_FAILURE_THRESHOLD = "3";
    process.env.PROXY_CIRCUIT_OPEN_MS = "60000";
  });

  after(() => {
    if (prevTimeout === undefined) {
      delete process.env.PROXY_UPSTREAM_TIMEOUT_MS;
    } else {
      process.env.PROXY_UPSTREAM_TIMEOUT_MS = prevTimeout;
    }
    if (prevThreshold === undefined) {
      delete process.env.PROXY_CIRCUIT_FAILURE_THRESHOLD;
    } else {
      process.env.PROXY_CIRCUIT_FAILURE_THRESHOLD = prevThreshold;
    }
    if (prevOpenMs === undefined) {
      delete process.env.PROXY_CIRCUIT_OPEN_MS;
    } else {
      process.env.PROXY_CIRCUIT_OPEN_MS = prevOpenMs;
    }
  });

  it("fails fast when upstream never responds (PI-01)", async () => {
    const upstream = await startHungUpstream();
    const proxy = new TenantHttpProxy({ upstreamBaseUrl: upstream.baseUrl, egressGuard: false });
    const started = Date.now();

    await assert.rejects(
      () =>
        runWithTenantContext(tenantId, async () => {
          await proxy.fetch("/slow-geocode");
        }),
      (error: unknown) => {
        assert.ok(error instanceof ProxyUpstreamTimeoutError);
        return true;
      }
    );

    const elapsed = Date.now() - started;
    assert.ok(elapsed < 2_000, `expected fail-fast under 2s; took ${elapsed}ms`);
    await upstream.close();
  });

  it("opens circuit after repeated upstream 5xx", async () => {
    const upstream = await startStatusUpstream(503);
    const proxy = new TenantHttpProxy({ upstreamBaseUrl: upstream.baseUrl, egressGuard: false });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await runWithTenantContext(tenantId, async () => {
        const response = await proxy.fetch("/broken");
        assert.equal(response.status, 503);
      });
    }

    const beforeOpen = upstream.requestCount();

    await assert.rejects(
      () =>
        runWithTenantContext(tenantId, async () => {
          await proxy.fetch("/broken");
        }),
      (error: unknown) => {
        assert.ok(error instanceof ProxyCircuitOpenError);
        return true;
      }
    );

    assert.equal(upstream.requestCount(), beforeOpen, "circuit open must not hit upstream");
    await upstream.close();
  });
});
