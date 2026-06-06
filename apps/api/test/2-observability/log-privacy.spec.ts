/**
 * 2-observability — log privacy audit for POST /tours.
 *
 * Executes createTour with PII in canonical payload and known tenant/user headers,
 * captures all pino log records, and asserts tenant/user identifiers never appear in
 * unstructured `msg` strings (structured JSON fields such as tenantId are allowed).
 *
 * Run:
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/2-observability/log-privacy.spec.ts
 *
 * @see docs/phase-4/appendices/observability.md — structured logging contract
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../../src/app";
import { drainHttpRequestLogQueueSync, withRequestLogging } from "../../src/http/request-logging";
import { logger } from "../../src/observability/logger";
import { createTestToursService, integrationTenantId } from "../test-helpers";

/** Fake PII embedded in canonical data — must not surface in log message strings. */
const PII = {
  ssn: "999-99-9999",
  email: "log.privacy.audit@example.com",
  fullName: "Log Privacy Audit Subject",
} as const;

type CapturedLogRecord = Record<string, unknown> & {
  msg?: string;
};

const PINO_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const;
type PinoLevel = (typeof PINO_LEVELS)[number];

type LogCapture = {
  readonly records: CapturedLogRecord[];
  restore: () => void;
};

/**
 * Intercepts the shared pino logger by wrapping level methods (and future child loggers).
 * Records normalized objects before delegating to the real sink.
 */
function installLogCapture(): LogCapture {
  const records: CapturedLogRecord[] = [];
  const originals = new Map<PinoLevel, (...args: unknown[]) => unknown>();

  const normalizeArgs = (...args: unknown[]): CapturedLogRecord => {
    if (args.length === 0) {
      return {};
    }
    if (typeof args[0] === "string") {
      return { msg: args[0] };
    }
    const record: CapturedLogRecord = {
      ...(args[0] as Record<string, unknown>),
    };
    if (typeof args[1] === "string") {
      record.msg = args[1];
    }
    return record;
  };

  const wrapLevelMethods = (target: Record<string, unknown>): void => {
    for (const level of PINO_LEVELS) {
      const original = target[level];
      if (typeof original !== "function") {
        continue;
      }
      const bound = (original as (...args: unknown[]) => unknown).bind(target);
      if (!originals.has(level)) {
        originals.set(level, bound);
      }
      target[level] = (...args: unknown[]) => {
        records.push(normalizeArgs(...args));
        return bound(...args);
      };
    }

    const origChild = target.child;
    if (typeof origChild === "function") {
      target.child = (...childArgs: unknown[]) => {
        const child = (origChild as (...a: unknown[]) => Record<string, unknown>).apply(
          target,
          childArgs
        );
        wrapLevelMethods(child);
        return child;
      };
    }
  };

  wrapLevelMethods(logger as unknown as Record<string, unknown>);

  return {
    records,
    restore: () => {
      for (const level of PINO_LEVELS) {
        const original = originals.get(level);
        if (original !== undefined) {
          (logger as unknown as Record<string, unknown>)[level] = original;
        }
      }
    },
  };
}

/**
 * Structured vs leak (audit contract):
 *   - ALLOWED: tenantId / userId as top-level JSON keys or nested object fields.
 *   - FORBIDDEN: those values interpolated into pino `msg` (human-readable message body).
 */
function assertNoSensitiveStringsInLogMessages(
  records: readonly CapturedLogRecord[],
  sensitive: readonly string[]
): void {
  const leaks: string[] = [];

  for (const record of records) {
    const msg = record.msg;
    if (typeof msg !== "string" || msg.length === 0) {
      continue;
    }
    for (const value of sensitive) {
      if (msg.includes(value)) {
        leaks.push(
          `msg contains "${value}": ${JSON.stringify({ event: record.event, msg: record.msg })}`
        );
      }
    }
  }

  assert.equal(
    leaks.length,
    0,
    `log privacy violation — tenant/user identifiers must stay in structured fields only:\n${leaks.join("\n")}`
  );
}

function authHeaders(tenantId: string, userId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": userId,
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-log-privacy",
  };
}

async function postTour(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  userId: string,
  body: unknown
): Promise<{ status: number; body: { id?: string; tenantId?: string; error?: string } }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/tours",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(payload)),
            ...authHeaders(tenantId, userId),
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
      req.write(payload);
      req.end();
    });
  });
}

describe("2-observability — log privacy (POST /tours)", () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorOutboxRelay = process.env.OUTBOX_RELAY_ENABLED;
  let capture: LogCapture;

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    process.env.OUTBOX_RELAY_ENABLED = "false";
    capture = installLogCapture();
  });

  after(() => {
    capture.restore();
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

  it("OBS-LOG-01: createTour logs must not embed tenantId/userId in msg strings", async () => {
    const tenantId = integrationTenantId();
    const userId = "00000000-0000-4000-8000-000000000099";
    const recordsBefore = capture.records.length;

    const toursService = createTestToursService();
    const listener = withRequestLogging(createRequestListener({ toursService }));

    const tourBody = {
      data: {
        basics: {
          title: "Log privacy audit tour",
          contactEmail: PII.email,
        },
        details: {
          summary: `Guest ${PII.fullName}`,
          notes: `Tax id probe ${PII.ssn}`,
        },
      },
    };

    const response = await postTour(listener, tenantId, userId, tourBody);
    drainHttpRequestLogQueueSync();

    assert.equal(
      response.status,
      201,
      `expected 201, got ${response.status}: ${JSON.stringify(response.body)}`
    );
    assert.equal(response.body.tenantId, tenantId);

    const requestLogs = capture.records.slice(recordsBefore);
    assert.ok(requestLogs.length > 0, "expected at least one log record during createTour");

    const httpRequestLog = requestLogs.find((record) => record.event === "http.request");
    assert.ok(httpRequestLog, "expected http.request structured log from withRequestLogging");
    assert.equal(httpRequestLog.msg, "request completed");
    const httpPath = (httpRequestLog.http as { path?: string } | undefined)?.path;
    assert.equal(httpPath, "/tours", "POST /tours path must not include query tokens");

    assertNoSensitiveStringsInLogMessages(requestLogs, [tenantId, userId]);

    // Structured metadata may carry tenantId in API response only — not required in logs today.
    const msgBodies = requestLogs
      .map((record) => record.msg)
      .filter((msg): msg is string => typeof msg === "string");
    assert.ok(
      msgBodies.every((msg) => !msg.includes(PII.ssn) && !msg.includes(PII.email)),
      "PII from canonical payload must not appear in unstructured log msg strings"
    );
  });

  it("LOG-COL-06: validation 400 path produces no error log with raw tenant_id", async () => {
    const tenantId = integrationTenantId();
    const userId = "00000000-0000-4000-8000-000000000088";
    const recordsBefore = capture.records.length;

    const listener = createRequestListener({ toursService: createTestToursService() });

    const response = await postTour(listener, tenantId, userId, {
      schemaVersion: 1,
      data: { basics: {}, details: { summary: "invalid" } },
    });

    assert.equal(response.status, 400);

    const requestLogs = capture.records.slice(recordsBefore);
    for (const record of requestLogs) {
      assert.equal(record.tenant_id, undefined);
      assert.equal(record.tenantId, undefined);
      if (typeof record.msg === "string") {
        assert.ok(
          !record.msg.includes(tenantId),
          "validation logs must not embed raw tenant id in msg"
        );
      }
    }
  });

  it("LOG-COL-08: GET access log redacts UUID path segments and strips query", async () => {
    const tenantId = integrationTenantId();
    const userId = "00000000-0000-4000-8000-000000000077";
    const tourId = "b0000000-0000-4000-8000-000000000001";
    const recordsBefore = capture.records.length;

    const listener = withRequestLogging(
      createRequestListener({ toursService: createTestToursService() })
    );
    await getTour(listener, tenantId, userId, tourId);

    const requestLogs = capture.records.slice(recordsBefore);
    const httpLog = requestLogs.find((record) => record.event === "http.request");
    assert.ok(httpLog, "expected http.request log for GET");
    const path = (httpLog.http as { path?: string } | undefined)?.path;
    assert.equal(path, "/tours/:id");
    assert.equal(path?.includes("?"), false);
    assert.equal(path?.includes(tourId), false);
  });
});

async function getTour(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  userId: string,
  tourId: string
): Promise<{ status: number }> {
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
          path: `/tours/${tourId}?debug=1`,
          method: "GET",
          headers: authHeaders(tenantId, userId),
        },
        (res) => {
          res.resume();
          res.on("end", () => {
            server.close();
            resolve({ status: res.statusCode ?? 0 });
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
