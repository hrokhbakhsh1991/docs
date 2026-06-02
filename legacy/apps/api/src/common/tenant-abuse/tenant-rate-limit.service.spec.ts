import assert from "node:assert/strict";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import { TenantRateLimitService } from "./tenant-rate-limit.service";
import { TenantAbuseMetricsService } from "./tenant-abuse-metrics.service";

function buildRequest(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  return {
    method: "GET",
    path: "/api/v2/users",
    url: "/api/v2/users",
    ip: "127.0.0.1",
    headers: {},
    tenant: { id: "11111111-1111-4111-8111-111111111111" },
    ...overrides
  };
}

function createService(opts?: {
  failMode?: "degraded" | "fail_closed" | "fail_open";
  redisEval?: () => Promise<number>;
  apiPerIp?: number;
}) {
  const redis = {
    eval: opts?.redisEval ?? (async () => 1),
    quit: async () => undefined
  };
  const configService = {
    isTenantRateLimitEnabled: () => true,
    getTenantRateLimitApiConfig: () => ({
      windowMs: 60_000,
      perTenant: 10,
      perUser: 10,
      perIp: opts?.apiPerIp ?? 2
    }),
    getTenantRateLimitLoginConfig: () => ({
      windowMs: 60_000,
      perTenant: 10,
      perIp: 10
    }),
    getTenantRateLimitJobConfig: () => ({
      windowMs: 60_000,
      perTenant: 10
    }),
    getRateLimitFailMode: () => opts?.failMode ?? "degraded",
    getTrustedProxyCidrs: () => []
  };
  const requestContextService = {
    resolveTenantContext: () => ({
      tenantId: "11111111-1111-4111-8111-111111111111",
      source: "host" as const
    }),
    tryGetUserId: () => "user-1",
    getRequestId: () => "req-1"
  };
  const logger = {
    warnCalls: [] as Array<Record<string, unknown>>,
    warn: (_message: string, payload: Record<string, unknown>) => {
      logger.warnCalls.push(payload);
    }
  };
  const metrics = new TenantAbuseMetricsService();
  const service = new TenantRateLimitService(
    redis as never,
    configService as never,
    requestContextService as never,
    logger as never,
    metrics
  );
  return { service, metrics, logger };
}

test("Redis failure activates degraded fallback and records metrics", async () => {
  const { service, metrics, logger } = createService({
    failMode: "degraded",
    redisEval: async () => {
      throw new Error("redis down");
    }
  });

  await service.enforceHttp(buildRequest() as never);

  const snapshot = metrics.getSnapshot();
  assert.equal(snapshot.rate_limit_redis_failures, 3);
  assert.equal(snapshot.rate_limit_fallback_activated, 3);
  assert.ok(logger.warnCalls.length >= 2);
});

test("degraded fallback still enforces per-IP API limit", async () => {
  const { service } = createService({
    failMode: "degraded",
    apiPerIp: 1,
    redisEval: async () => {
      throw new Error("redis down");
    }
  });
  const req = buildRequest() as never;

  await service.enforceHttp(req);

  await assert.rejects(
    async () => {
      await service.enforceHttp(req);
    },
    (err: unknown) => {
      assert.ok(err instanceof HttpException);
      assert.equal(err.getStatus(), 429);
      return true;
    }
  );
});
