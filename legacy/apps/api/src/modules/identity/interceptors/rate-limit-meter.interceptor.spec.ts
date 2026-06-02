import assert from "node:assert/strict";
import test from "node:test";
import { HttpException } from "@nestjs/common";
import { of } from "rxjs";
import { firstValueFrom } from "rxjs";
import { RateLimitMeterInterceptor } from "./rate-limit-meter.interceptor";
import type { WorkspaceMeteringPort } from "../../../common/billing/workspace-metering.port";
import type { RequestContextService } from "../../../common/request-context/request-context.service";

function createInterceptor(deps: {
  metering: WorkspaceMeteringPort;
  tenantId?: string;
}) {
  const requestContext = {
    resolveTenantContext: () => ({ tenantId: deps.tenantId }),
  } as RequestContextService;
  return new RateLimitMeterInterceptor(deps.metering, requestContext);
}

function mockExecutionContext(req: {
  method: string;
  path: string;
  body?: unknown;
}) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as never;
}

test("RateLimitMeterInterceptor bypasses health paths", async () => {
  const metering: WorkspaceMeteringPort = {
    async getCachedPlanLimits() {
      throw new Error("should not load limits");
    },
    async getCachedUsageSnapshot() {
      throw new Error("should not load usage");
    },
  };
  const interceptor = createInterceptor({ metering, tenantId: "t1" });
  const result = await interceptor.intercept(
    mockExecutionContext({ method: "POST", path: "/health" }),
    { handle: () => of("ok") },
  );
  assert.equal(await firstValueFrom(result), "ok");
});

test("RateLimitMeterInterceptor allows under-limit tour create", async () => {
  const metering: WorkspaceMeteringPort = {
    async getCachedPlanLimits() {
      return { tier: "starter", maxActiveTours: 5, maxUsers: 10 };
    },
    async getCachedUsageSnapshot() {
      return { activeTours: 2, users: 3 };
    },
  };
  const interceptor = createInterceptor({
    metering,
    tenantId: "11111111-1111-4111-8111-111111111111",
  });
  const result = await interceptor.intercept(
    mockExecutionContext({ method: "POST", path: "/api/v2/tours" }),
    { handle: () => of("created") },
  );
  assert.equal(await firstValueFrom(result), "created");
});

test("RateLimitMeterInterceptor blocks tour create at active tour cap", async () => {
  const metering: WorkspaceMeteringPort = {
    async getCachedPlanLimits() {
      return { tier: "starter", maxActiveTours: 5, maxUsers: 10 };
    },
    async getCachedUsageSnapshot() {
      return { activeTours: 5, users: 3 };
    },
  };
  const interceptor = createInterceptor({
    metering,
    tenantId: "11111111-1111-4111-8111-111111111111",
  });
  await assert.rejects(
    () =>
      interceptor.intercept(
        mockExecutionContext({ method: "POST", path: "/api/v2/tours" }),
        { handle: () => of("created") },
      ),
    (err: unknown) => {
      assert.ok(err instanceof HttpException);
      assert.equal(err.getStatus(), 429);
      const body = err.getResponse() as { error?: { code?: string; details?: { quota_scope?: string } } };
      return (
        body.error?.code === "TENANT_QUOTA_EXCEEDED" &&
        body.error?.details?.quota_scope === "active_tours"
      );
    },
  );
});

test("RateLimitMeterInterceptor blocks user invite at user cap", async () => {
  const metering: WorkspaceMeteringPort = {
    async getCachedPlanLimits() {
      return { tier: "starter", maxActiveTours: 5, maxUsers: 10 };
    },
    async getCachedUsageSnapshot() {
      return { activeTours: 1, users: 10 };
    },
  };
  const interceptor = createInterceptor({
    metering,
    tenantId: "11111111-1111-4111-8111-111111111111",
  });
  await assert.rejects(
    () =>
      interceptor.intercept(
        mockExecutionContext({ method: "POST", path: "/api/v2/users/invite" }),
        { handle: () => of("invited") },
      ),
    (err: unknown) => {
      assert.ok(err instanceof HttpException);
      const body = err.getResponse() as { error?: { details?: { quota_scope?: string } } };
      return body.error?.details?.quota_scope === "users";
    },
  );
});
