import assert from "node:assert/strict";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import { TenantUsageMeteringService } from "./tenant-usage-metering.service";

function buildReq(): Record<string, unknown> {
  return {
    method: "GET",
    path: "/api/v2/users",
    url: "/api/v2/users",
    ip: "127.0.0.1",
    headers: {},
    tenant: { id: "11111111-1111-4111-8111-111111111111" }
  };
}

test("enforceAndRecordHttpRequest throws 429 when daily api quota exceeded", async () => {
  const usageRepo = {
    query: async (sql: string) => {
      if (sql.includes("api_requests_per_day")) {
        return [{ api_requests: "11", api_requests_per_day: "10" }];
      }
      return [];
    }
  };
  const svc = new TenantUsageMeteringService(
    usageRepo as never,
    {
      getTrustedProxyCidrs: () => []
    } as never,
    {
      resolveTenantContext: () => ({
        tenantId: "11111111-1111-4111-8111-111111111111",
        source: "jwt" as const
      })
    } as never,
    {
      warn: () => undefined
    } as never
  );

  await assert.rejects(
    async () => {
      await svc.enforceAndRecordHttpRequest(buildReq() as never);
    },
    (err: unknown) => {
      assert.ok(err instanceof HttpException);
      assert.equal(err.getStatus(), 429);
      return true;
    }
  );
});

test("tryConsumeBackgroundJob returns false when jobs_per_day exceeded", async () => {
  const usageRepo = {
    query: async (sql: string) => {
      if (sql.includes("jobs_per_day")) {
        return [{ background_jobs: "6", jobs_per_day: "5" }];
      }
      return [];
    }
  };
  const svc = new TenantUsageMeteringService(
    usageRepo as never,
    {
      getTrustedProxyCidrs: () => []
    } as never,
    {
      resolveTenantContext: () => ({
        tenantId: undefined,
        source: undefined
      })
    } as never,
    {
      warn: () => undefined
    } as never
  );

  const ok = await svc.tryConsumeBackgroundJob("11111111-1111-4111-8111-111111111111");
  assert.equal(ok, false);
});

