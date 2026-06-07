/**
 * Phase 8.1 — ASM-8.1-011, 012, 016, 017 redis + workspace resolve
 * Authority: docs/phase-8/appendices/AGENT-STATE-MAP-8.1.yaml
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { disconnectPrisma } from "../src/db/prisma";
import { resetRedisRateLimiterCircuitForTests } from "../src/middleware/redis-rate-limiter-resilience";
import { resetTenantRateLimiterStoreForTests } from "../src/middleware/tenant-rate-limiter";
import { encodeDevBearerToken } from "../src/tenant-kernel/parse-bearer";
import { createTestToursService } from "./test-helpers";

const URBAN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const URBAN_WORKSPACE_ID = "00000000-0000-4000-8000-000000000403";
const URBAN_OWNER_USER_ID = "00000000-0000-4000-8000-000000000401";

const VALID_BODY = {
  urban: {
    catalog: { publicEnabled: true, slug: "catalog" },
    registration: { policy: "open" as const },
  },
};

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      assert.equal(actual, expected);
    },
  };
}

function ownerBearer(): string {
  return encodeDevBearerToken({
    userId: URBAN_OWNER_USER_ID,
    tenantId: URBAN_TENANT_ID,
    role: "owner",
    status: "ACTIVE",
    workspaceId: URBAN_WORKSPACE_ID,
  });
}

describe("Phase 8.1 — ASM workspace resolve failure (011, 012)", () => {
  let listener: ReturnType<typeof createRequestListener>;

  before(() => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    process.env.STORAGE_DRIVER = "memory";
    listener = createRequestListener({ toursService: createTestToursService() });
  });

  async function requestUrban(
    method: "GET" | "PATCH",
    body?: unknown
  ): Promise<{ status: number; body: unknown }> {
    return new Promise((resolve, reject) => {
      const server = http.createServer(listener);
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          server.close();
          reject(new Error("no listen address"));
          return;
        }
        const payload = body === undefined ? undefined : JSON.stringify(body);
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: addr.port,
            path: "/urban/settings",
            method,
            headers: {
              Authorization: ownerBearer(),
              ...(payload
                ? {
                    "Content-Type": "application/json",
                    "Content-Length": String(Buffer.byteLength(payload)),
                  }
                : {}),
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

  it("ASM-8.1-011 GET /urban/settings resolveWorkspaceTypeForTenant throw returns 500 INTERNAL_SERVER_ERROR", async () => {
    process.env.URBAN_TEST_INJECT_WORKSPACE_TYPE_THROW = "1";
    const response = await requestUrban("GET");
    delete process.env.URBAN_TEST_INJECT_WORKSPACE_TYPE_THROW;
    expect(response.status).toBe(500);
    expect((response.body as { error?: string }).error).toBe("INTERNAL_SERVER_ERROR");
  });

  it("ASM-8.1-012 PATCH /urban/settings resolveWorkspaceTypeForTenant throw returns 500 INTERNAL_SERVER_ERROR", async () => {
    process.env.URBAN_TEST_INJECT_WORKSPACE_TYPE_THROW = "1";
    const response = await requestUrban("PATCH", VALID_BODY);
    delete process.env.URBAN_TEST_INJECT_WORKSPACE_TYPE_THROW;
    expect(response.status).toBe(500);
    expect((response.body as { error?: string }).error).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("Phase 8.1 — ASM redis closed policy after owner assert (016, 017)", () => {
  let server: http.Server;
  const envSnapshot = {
    REDIS_URL: process.env.REDIS_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    TENANT_RATE_LIMIT_ENABLED: process.env.TENANT_RATE_LIMIT_ENABLED,
    TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY: process.env.TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    NODE_ENV: process.env.NODE_ENV,
    AUTH_ALLOW_DEV_BEARER: process.env.AUTH_ALLOW_DEV_BEARER,
  };

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.DATABASE_URL;
    process.env.REDIS_URL = "redis://127.0.0.1:59999";
    process.env.TENANT_RATE_LIMIT_ENABLED = "true";
    process.env.TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY = "closed";
    await resetTenantRateLimiterStoreForTests();
    resetRedisRateLimiterCircuitForTests();
    const listener = createRequestListener({ toursService: createTestToursService() });
    server = http.createServer(listener);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  after(async () => {
    process.env.REDIS_URL = envSnapshot.REDIS_URL;
    process.env.TENANT_RATE_LIMIT_ENABLED = envSnapshot.TENANT_RATE_LIMIT_ENABLED;
    process.env.TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY =
      envSnapshot.TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY;
    process.env.STORAGE_DRIVER = envSnapshot.STORAGE_DRIVER;
    process.env.NODE_ENV = envSnapshot.NODE_ENV;
    process.env.AUTH_ALLOW_DEV_BEARER = envSnapshot.AUTH_ALLOW_DEV_BEARER;
    if (envSnapshot.DATABASE_URL === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = envSnapshot.DATABASE_URL;
    }
    await disconnectPrisma();
    await resetTenantRateLimiterStoreForTests();
    resetRedisRateLimiterCircuitForTests();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  async function requestUrban(
    method: "GET" | "PATCH",
    body?: unknown
  ): Promise<{ status: number; body: unknown }> {
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("server not listening");
    }
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/urban/settings",
          method,
          headers: {
            Authorization: ownerBearer(),
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(Buffer.byteLength(payload)),
                }
              : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? JSON.parse(raw) : null,
            });
          });
        }
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  it("ASM-8.1-016 GET /urban/settings owner after assert redis closed returns 503 RATE_LIMITER_REDIS_UNAVAILABLE", async () => {
    const response = await requestUrban("GET");
    expect(response.status).toBe(503);
    expect((response.body as { code?: string }).code).toBe("RATE_LIMITER_REDIS_UNAVAILABLE");
  });

  it("ASM-8.1-017 PATCH /urban/settings owner after assert redis closed returns 503 RATE_LIMITER_REDIS_UNAVAILABLE", async () => {
    const response = await requestUrban("PATCH", VALID_BODY);
    expect(response.status).toBe(503);
    expect((response.body as { code?: string }).code).toBe("RATE_LIMITER_REDIS_UNAVAILABLE");
  });
});
