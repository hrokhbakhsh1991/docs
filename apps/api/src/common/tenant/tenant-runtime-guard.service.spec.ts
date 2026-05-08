import assert from "node:assert/strict";
import test from "node:test";
import { TenantRuntimeGuardService } from "./tenant-runtime-guard.service";

test("enforceTenantRuntimePolicies applies rate-limit only action", async () => {
  let rateLimitCalls = 0;
  let usageCalls = 0;
  const service = new TenantRuntimeGuardService(
    {
      enforceHttpRateLimit: async () => {
        rateLimitCalls += 1;
      }
    } as never,
    {
      enforceHttpUsageMetering: async () => {
        usageCalls += 1;
      }
    } as never
  );

  await service.enforceTenantRuntimePolicies({} as never, "http_rate_limit");
  assert.equal(rateLimitCalls, 1);
  assert.equal(usageCalls, 0);
});

test("enforceTenantRuntimePolicies applies usage-metering only action", async () => {
  let rateLimitCalls = 0;
  let usageCalls = 0;
  const service = new TenantRuntimeGuardService(
    {
      enforceHttpRateLimit: async () => {
        rateLimitCalls += 1;
      }
    } as never,
    {
      enforceHttpUsageMetering: async () => {
        usageCalls += 1;
      }
    } as never
  );

  await service.enforceTenantRuntimePolicies({} as never, "http_usage_metering");
  assert.equal(rateLimitCalls, 0);
  assert.equal(usageCalls, 1);
});

test("enforceTenantRuntimePolicies applies both checks for http_all", async () => {
  let rateLimitCalls = 0;
  let usageCalls = 0;
  const service = new TenantRuntimeGuardService(
    {
      enforceHttpRateLimit: async () => {
        rateLimitCalls += 1;
      }
    } as never,
    {
      enforceHttpUsageMetering: async () => {
        usageCalls += 1;
      }
    } as never
  );

  await service.enforceTenantRuntimePolicies({} as never, "http_all");
  assert.equal(rateLimitCalls, 1);
  assert.equal(usageCalls, 1);
});
