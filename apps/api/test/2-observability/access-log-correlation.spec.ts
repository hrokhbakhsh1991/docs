/**
 * TRACE-LOST-01 / DEC-048 — http.request access log carries ingress correlation_id.
 *
 * Run:
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/2-observability/access-log-correlation.spec.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { drainHttpRequestLogQueueSync, withRequestLogging } from "../../src/http/request-logging";
import { logger } from "../../src/observability/logger";
import { createTestToursService, integrationTenantId } from "../test-helpers";

type CapturedLogRecord = Record<string, unknown>;

function installInfoCapture(): { records: CapturedLogRecord[]; restore: () => void } {
  const records: CapturedLogRecord[] = [];
  const original = logger.info.bind(logger);
  logger.info = ((...args: unknown[]) => {
    if (typeof args[0] === "object" && args[0] !== null) {
      records.push({ ...(args[0] as Record<string, unknown>) });
    }
    return original(...(args as Parameters<typeof logger.info>));
  }) as typeof logger.info;
  return {
    records,
    restore: () => {
      logger.info = original;
    },
  };
}

async function getHealth(
  listener: (req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>,
  headers: Record<string, string> = {}
): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/health",
          method: "GET",
          headers,
        },
        (res) => {
          res.resume();
          res.on("end", () => {
            server.close();
            resolve(res.statusCode ?? 0);
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      req.end();
    });
  });
}

describe("2-observability — access log correlation (TRACE-LOST-01)", () => {
  let capture: ReturnType<typeof installInfoCapture>;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    process.env.OUTBOX_RELAY_ENABLED = "false";
    capture = installInfoCapture();
  });

  after(() => {
    capture.restore();
  });

  it("TRACE-LOST-01a: http.request includes correlation_id from x-correlation-id", async () => {
    const correlationId = randomUUID();
    const before = capture.records.length;
    const toursService = createTestToursService();
    const listener = withRequestLogging(createRequestListener({ toursService }));

    const status = await getHealth(listener, { "x-correlation-id": correlationId });
    assert.equal(status, 200);

    const accessLog = capture.records.slice(before).find((r) => r.event === "http.request");
    assert.ok(accessLog, "expected http.request log");
    assert.equal(accessLog.correlation_id, correlationId);
    assert.equal((accessLog.http as { path?: string })?.path, "/health");
  });

  it("TRACE-LOST-01b: concurrent tenants keep distinct correlation_id on access logs", async () => {
    const correlationA = randomUUID();
    const correlationB = randomUUID();
    const before = capture.records.length;
    const toursService = createTestToursService();
    const listener = withRequestLogging(createRequestListener({ toursService }));

    const [statusA, statusB] = await Promise.all([
      getHealth(listener, { "x-correlation-id": correlationA }),
      getHealth(listener, { "x-correlation-id": correlationB }),
    ]);
    assert.equal(statusA, 200);
    assert.equal(statusB, 200);

    const accessLogs = capture.records.slice(before).filter((r) => r.event === "http.request");
    assert.equal(accessLogs.length, 2);
    const ids = accessLogs.map((r) => r.correlation_id).sort();
    assert.deepEqual(ids, [correlationA, correlationB].sort());
  });

  it("TRACE-LOST-01c: POST /tours access log matches ingress correlation header", async () => {
    const tenantId = integrationTenantId();
    const correlationId = randomUUID();
    const before = capture.records.length;
    const toursService = createTestToursService();
    const listener = withRequestLogging(createRequestListener({ toursService }));

    await new Promise<void>((resolve, reject) => {
      const server = http.createServer(listener);
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          server.close();
          reject(new Error("no listen address"));
          return;
        }
        const body = JSON.stringify({
          schemaVersion: 1,
          roots: ["basics", "details"],
          data: { basics: { title: "access-log-correlation" }, details: { summary: "ok" } },
        });
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: addr.port,
            path: "/tours",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": String(Buffer.byteLength(body)),
              "x-correlation-id": correlationId,
              "x-tenant-id": tenantId,
              "x-authenticated-tenant-id": tenantId,
              "x-user-id": "access-log-user",
              "x-actor-role": "admin",
              "x-membership-status": "ACTIVE",
              "x-workspace-id": "ws-access-log",
            },
          },
          (res) => {
            res.resume();
            res.on("end", () => {
              server.close();
              resolve();
            });
          }
        );
        req.on("error", (err) => {
          server.close();
          reject(err);
        });
        req.write(body);
        req.end();
      });
    });

    drainHttpRequestLogQueueSync();

    const accessLog = capture.records.slice(before).find((r) => r.event === "http.request");
    assert.ok(accessLog);
    assert.equal(accessLog.correlation_id, correlationId);
  });
});
