/**
 * 2-observability — error enrichment contract for POST /tours.
 *
 * Support-engineer contract:
 *   - Client receives a correlation id (header echo or JSON field) on 4xx/5xx for ticket lookup.
 *   - Thrown errors inside trace + tenant ALS carry tenant_id and correlation_id when enriched.
 *   - Error responses MUST NOT leak engine internals (stack, SQL, RuleEngine paths, file:line).
 *
 * Run (memory — validation 400 + mock 500):
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/2-observability/error-enrichment.spec.ts
 *
 * @see docs/phase-4/appendices/observability.md — correlation_id_smoke (RECOMMENDED)
 * @see docs/phase-5/appendices/trace-request-context.md — trace ALS scaffold
 * @see apps/api/test/1-functional/create-tour-flow.spec.ts — validation 400 shape baseline
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { createRequestListener } from "../../src/app";
import { isValidationFailure } from "../../src/canonical/validation-failure";
import { logger } from "../../src/observability/logger";
import { INTERNAL_ERROR, hashTenantIdForLog } from "../../src/observability/log-safety";
import { runWithTraceContext } from "../../src/observability/trace-request-context";
import { runWithTenantContext } from "../../src/tenant/tenant-request-context";
import type { ToursService } from "../../src/tours/tours.service";
import { createTestToursService, integrationTenantId } from "../test-helpers";

/** Invalid starter canonical — basics.title required; fails before any TX (see create-tour-flow). */
const INVALID_TOUR_BODY = {
  schemaVersion: 1,
  roots: ["basics", "details"],
  data: {
    basics: {},
    details: { summary: "ok" },
  },
} as const;

/** Substrings that must never appear in client-facing error payloads or headers. */
const FORBIDDEN_LEAK_PATTERNS: readonly RegExp[] = [
  /\n\s+at\s+/i,
  /\bat\s+Object\./i,
  /\bat\s+Module\./i,
  /node_modules/i,
  /RuleEngine/i,
  /rule-engine/i,
  /\bprisma\b/i,
  /\bSELECT\s+/i,
  /\bINSERT\s+/i,
  /\bUPDATE\s+/i,
  /\bDELETE\s+/i,
  /\bstack\b/i,
  /ValidationFailure/i,
  /apps\/api\/src\//i,
  /\.tsx:\d+/i,
  /\.ts:\d+/i,
];

type HttpResult = {
  readonly status: number;
  readonly headers: http.IncomingHttpHeaders;
  readonly body: Record<string, unknown>;
};

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "error-enrichment-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-error-enrichment",
  };
}

function readHeader(headers: http.IncomingHttpHeaders, name: string): string | undefined {
  const raw = headers[name.toLowerCase()] ?? headers[name];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(raw)) {
    for (const value of raw) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
  }
  return undefined;
}

function resolveResponseCorrelationId(result: HttpResult): string | undefined {
  const fromBody =
    (typeof result.body.correlationId === "string" && result.body.correlationId.trim()) ||
    (typeof result.body.correlation_id === "string" && result.body.correlation_id.trim()) ||
    (typeof result.body.requestId === "string" && result.body.requestId.trim()) ||
    undefined;

  const fromHeader =
    readHeader(result.headers, "x-correlation-id") ??
    readHeader(result.headers, "x-request-id") ??
    readHeader(result.headers, "x-trace-id");

  return fromBody ?? fromHeader;
}

function assertNoInternalLeak(result: HttpResult, label: string): void {
  const serialized = JSON.stringify({
    body: result.body,
    headers: {
      "x-correlation-id": readHeader(result.headers, "x-correlation-id"),
      "x-request-id": readHeader(result.headers, "x-request-id"),
    },
  });

  const hits: string[] = [];
  for (const pattern of FORBIDDEN_LEAK_PATTERNS) {
    if (pattern.test(serialized)) {
      hits.push(pattern.source);
    }
  }

  assert.equal(
    hits.length,
    0,
    `${label}: response must not leak engine internals; matched: ${hits.join(", ")}\n${serialized}`
  );
}

async function postTour(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  body: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<HttpResult> {
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
            ...authHeaders(tenantId),
            ...extraHeaders,
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
              headers: res.headers,
              body: raw.length > 0 ? (JSON.parse(raw) as Record<string, unknown>) : {},
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

type EnrichedErrorShape = Error & {
  tenant_id?: string;
  tenantId?: string;
  correlation_id?: string;
  correlationId?: string;
};

function readEnrichedTenantId(error: EnrichedErrorShape): string | undefined {
  return error.tenant_id ?? error.tenantId;
}

function readEnrichedCorrelationId(error: EnrichedErrorShape): string | undefined {
  return error.correlation_id ?? error.correlationId;
}

describe("2-observability — error enrichment (POST /tours)", () => {
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

  it("OBS-ERR-01: validation 400 echoes correlation id for support lookup", async () => {
    const tenantId = integrationTenantId();
    const correlationId = randomUUID();
    const listener = createRequestListener({ toursService: createTestToursService() });

    const result = await postTour(listener, tenantId, INVALID_TOUR_BODY, {
      "x-correlation-id": correlationId,
    });

    assert.equal(
      result.status,
      400,
      `expected 400 validation; body=${JSON.stringify(result.body)}`
    );
    assert.equal(result.body.code, "VALIDATION_FAILURE");

    const echoed = resolveResponseCorrelationId(result);
    assert.equal(
      echoed,
      correlationId,
      "support lookup requires correlation id in response body or x-correlation-id / x-request-id header"
    );
  });

  it("OBS-ERR-02: validation 400 response must not leak engine internals", async () => {
    const tenantId = integrationTenantId();
    const correlationId = randomUUID();
    const listener = createRequestListener({ toursService: createTestToursService() });

    const result = await postTour(listener, tenantId, INVALID_TOUR_BODY, {
      "x-request-id": correlationId,
    });

    assert.equal(result.status, 400);
    assertNoInternalLeak(result, "validation 400");

    assert.ok(
      typeof result.body.error === "string" && result.body.error.length > 0,
      "client-safe error message required"
    );
  });

  it("OBS-ERR-03: service-layer ValidationFailure carries tenant_id and correlation_id when enriched", async () => {
    const tenantId = integrationTenantId();
    const correlationId = randomUUID();
    const toursService = createTestToursService();

    const auth: TenantAuthContext = {
      tenantId,
      userId: "error-enrichment-user",
      role: "admin",
      status: "ACTIVE",
    };

    let caught: unknown;
    await runWithTraceContext(correlationId, async () =>
      runWithTenantContext(tenantId, async () => {
        try {
          await toursService.createTour(auth, INVALID_TOUR_BODY);
        } catch (error) {
          caught = error;
        }
      })
    );

    assert.ok(caught instanceof Error, "validation must throw");
    assert.ok(isValidationFailure(caught), "expected ValidationFailure from canonical gate");

    const enriched = caught as EnrichedErrorShape;
    assert.equal(
      readEnrichedTenantId(enriched),
      tenantId,
      "enriched error must include tenant_id for log/support correlation"
    );
    assert.equal(
      readEnrichedCorrelationId(enriched),
      correlationId,
      "enriched error must include correlation_id from active trace ALS"
    );
  });

  it("OBS-ERR-04: internal 500 returns internal_error with correlation and no leak", async () => {
    const tenantId = integrationTenantId();
    const correlationId = randomUUID();

    const faultService = {
      createTour: async () => {
        throw new Error(
          "simulated_fault at Object.<anonymous> (/apps/api/src/tours/tours.service.ts:99:11)"
        );
      },
      getTourById: async () => null,
    } satisfies Pick<ToursService, "createTour" | "getTourById">;

    const listener = createRequestListener({
      toursService: faultService as ToursService,
    });

    const validBody = {
      data: { basics: { title: "error-enrichment-500" }, details: { summary: "ok" } },
    };

    const result = await postTour(listener, tenantId, validBody, {
      "x-correlation-id": correlationId,
    });

    assert.equal(result.status, 500, `expected 500; body=${JSON.stringify(result.body)}`);
    assert.equal(result.body.error, "internal_error", "500 must map to opaque internal_error");
    assert.equal(result.body.stack, undefined, "stack must not be serialized");
    assertNoInternalLeak(result, "internal 500");

    const echoed = resolveResponseCorrelationId(result);
    assert.equal(
      echoed,
      correlationId,
      "500 responses must still expose correlation id for support tickets"
    );
  });

  it("LOG-COL-01: internal 500 log uses tenant_hash and error_code only", async () => {
    const tenantId = integrationTenantId();
    const correlationId = randomUUID();
    const faultService = {
      createTour: async () => {
        throw new Error(
          "simulated_fault at Object.<anonymous> (/apps/api/src/tours/tours.service.ts:99:11)"
        );
      },
      getTourById: async () => null,
    } satisfies Pick<ToursService, "createTour" | "getTourById">;

    const listener = createRequestListener({
      toursService: faultService as ToursService,
    });

    const errorRecords: Record<string, unknown>[] = [];
    const originalError = logger.error.bind(logger);
    logger.error = ((...args: unknown[]) => {
      if (typeof args[0] === "object" && args[0] !== null) {
        errorRecords.push(args[0] as Record<string, unknown>);
      }
      return originalError(...args);
    }) as typeof logger.error;

    try {
      await postTour(
        listener,
        tenantId,
        {
          data: { basics: { title: "log-col-500" }, details: { summary: "ok" } },
        },
        { "x-correlation-id": correlationId }
      );
    } finally {
      logger.error = originalError;
    }

    const internalLog = errorRecords.find((record) => record.event === "http.error.internal");
    assert.ok(internalLog, "500 path must emit http.error.internal log record");
    assert.equal(internalLog.correlation_id, correlationId);
    assert.equal(internalLog.error_code, INTERNAL_ERROR);
    assert.equal(internalLog.tenant_id, undefined, "must never log raw tenant_id on shared stream");
    assert.equal(internalLog.message, undefined);
    assert.equal(internalLog.stack, undefined);
    if (internalLog.tenant_hash !== undefined) {
      assert.equal(internalLog.tenant_hash, hashTenantIdForLog(tenantId));
      assert.notEqual(internalLog.tenant_hash, tenantId);
    }
  });

  it("LOG-COL-06: validation 400 does not emit http.error.internal or co-located tenant_id+message logs", async () => {
    const tenantId = integrationTenantId();
    const listener = createRequestListener({ toursService: createTestToursService() });

    const errorRecords: Record<string, unknown>[] = [];
    const originalError = logger.error.bind(logger);
    logger.error = ((...args: unknown[]) => {
      if (typeof args[0] === "object" && args[0] !== null) {
        errorRecords.push(args[0] as Record<string, unknown>);
      }
      return originalError(...args);
    }) as typeof logger.error;

    try {
      const result = await postTour(listener, tenantId, INVALID_TOUR_BODY);
      assert.equal(result.status, 400);
    } finally {
      logger.error = originalError;
    }

    assert.equal(
      errorRecords.find((record) => record.event === "http.error.internal"),
      undefined,
      "validation 400 must not hit internal 500 log path"
    );

    for (const record of errorRecords) {
      assert.equal(record.tenant_id, undefined);
      assert.equal(record.tenantId, undefined);
      if (record.message !== undefined) {
        assert.notEqual(
          typeof record.tenant_hash === "string" ? record.tenant_hash : undefined,
          tenantId
        );
      }
    }
  });

  it("LOG-COL-07: schema version mismatch 400 does not emit internal error logs", async () => {
    const tenantId = integrationTenantId();
    const listener = createRequestListener({ toursService: createTestToursService() });

    const errorRecords: Record<string, unknown>[] = [];
    const originalError = logger.error.bind(logger);
    logger.error = ((...args: unknown[]) => {
      if (typeof args[0] === "object" && args[0] !== null) {
        errorRecords.push(args[0] as Record<string, unknown>);
      }
      return originalError(...args);
    }) as typeof logger.error;

    try {
      const result = await postTour(listener, tenantId, {
        schemaVersion: 99,
        data: { basics: { title: "schema-mismatch" }, details: { summary: "ok" } },
      });
      assert.equal(result.status, 400);
      assert.equal(result.body.code, "SCHEMA_VERSION_MISMATCH");
    } finally {
      logger.error = originalError;
    }

    assert.equal(
      errorRecords.find((record) => record.event === "http.error.internal"),
      undefined
    );
  });

  it("OBS-ERR-05: x-request-id is accepted as correlation source when x-correlation-id absent", async () => {
    const tenantId = integrationTenantId();
    const requestId = randomUUID();
    const listener = createRequestListener({ toursService: createTestToursService() });

    const result = await postTour(listener, tenantId, INVALID_TOUR_BODY, {
      "x-request-id": requestId,
    });

    assert.equal(result.status, 400);
    const echoed = resolveResponseCorrelationId(result);
    assert.equal(
      echoed,
      requestId,
      "x-request-id must round-trip as correlation id per trace-request-context.md"
    );
  });
});
