/**
 * ERR-BYPASS-01 / DEC-126 — internal routes echo correlationId via handleHttpError.
 *
 * Run:
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/2-observability/internal-route-correlation.spec.ts
 */
import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { CORRELATION_ID_HEADER } from "../../src/middleware/error-interceptor";

function readHeader(headers: http.IncomingHttpHeaders, name: string): string | undefined {
  const raw = headers[name.toLowerCase()] ?? headers[name];
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  return undefined;
}

async function httpRequest(
  port: number,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: unknown
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers: {
          ...(payload !== undefined
            ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) }
            : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {},
          });
        });
      }
    );
    req.on("error", reject);
    if (payload !== undefined) {
      req.write(payload);
    }
    req.end();
  });
}

describe("internal route correlation (ERR-BYPASS-01)", () => {
  it("provision validation error includes correlationId matching ingress trace header", async () => {
    const priorNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    const server = http.createServer(createRequestListener({ toursService: {} as never }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;
    const traceId = "internal-provision-trace-01";

    try {
      const result = await httpRequest(
        port,
        "POST",
        "/internal/tenants/provision",
        { "x-trace-id": traceId },
        { subdomain: "bad-provision" }
      );

      assert.ok(result.status >= 400 && result.status < 500);
      assert.equal(readHeader(result.headers, CORRELATION_ID_HEADER), traceId);
      assert.equal(result.body.correlationId, traceId);
    } finally {
      server.close();
      await new Promise<void>((resolve) => server.on("close", resolve));
      process.env.NODE_ENV = priorNodeEnv;
    }
  });

  it("db-pool-hold auth error includes correlationId matching ingress trace header", async () => {
    const priorNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    const server = http.createServer(createRequestListener({ toursService: {} as never }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;
    const traceId = "internal-db-pool-hold-trace-01";

    try {
      const result = await httpRequest(port, "GET", "/internal/test/db-pool-hold", {
        "x-trace-id": traceId,
      });

      assert.ok(result.status >= 400);
      assert.equal(readHeader(result.headers, CORRELATION_ID_HEADER), traceId);
      assert.equal(result.body.correlationId, traceId);
    } finally {
      server.close();
      await new Promise<void>((resolve) => server.on("close", resolve));
      process.env.NODE_ENV = priorNodeEnv;
    }
  });

  it("unknown route returns JSON 404 with correlationId (ERR-BYPASS-02)", async () => {
    const server = http.createServer(createRequestListener({ toursService: {} as never }));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;
    const traceId = "not-found-trace-01";

    try {
      const result = await httpRequest(port, "GET", "/does-not-exist", { "x-trace-id": traceId });
      assert.equal(result.status, 404);
      assert.equal(result.body.error, "not_found");
      assert.equal(result.body.code, "NOT_FOUND");
      assert.equal(result.body.correlationId, traceId);
    } finally {
      server.close();
      await new Promise<void>((resolve) => server.on("close", resolve));
    }
  });
});
