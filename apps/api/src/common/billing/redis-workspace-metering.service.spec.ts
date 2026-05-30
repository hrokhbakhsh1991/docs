import assert from "node:assert/strict";
import test from "node:test";
import type Redis from "ioredis";
import { DEFAULT_WORKSPACE_PLAN_TIER, resolveWorkspacePlanTierLimits } from "@repo/shared";
import { RedisWorkspaceMeteringService } from "./redis-workspace-metering.service";

class MiniRedis {
  readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }

  async set(key: string, value: string, mode?: string, _ttl?: number): Promise<"OK"> {
    if (mode === "EX") {
      this.data.set(key, value);
    } else {
      this.data.set(key, value);
    }
    return "OK";
  }
}

test("resolveWorkspacePlanTierLimits defaults to starter tier", () => {
  const limits = resolveWorkspacePlanTierLimits({});
  assert.equal(limits.tier, DEFAULT_WORKSPACE_PLAN_TIER);
  assert.equal(limits.maxActiveTours, 5);
  assert.equal(limits.maxUsers, 10);
});

test("RedisWorkspaceMeteringService caches plan limits on miss", async () => {
  const mini = new MiniRedis();
  const service = new RedisWorkspaceMeteringService(
    mini as unknown as Redis,
    {
      async findOne() {
        return {
          tenantId: "11111111-1111-4111-8111-111111111111",
          planTier: "growth",
          maxActiveTours: null,
          maxUsers: null,
        };
      },
      async query() {
        return [];
      },
    } as never,
  );

  const limits = await service.getCachedPlanLimits("11111111-1111-4111-8111-111111111111");
  assert.equal(limits.tier, "growth");
  assert.equal(limits.maxActiveTours, 25);
  assert.ok(mini.data.has("tenant:plan:limits:11111111-1111-4111-8111-111111111111"));

  const cached = await service.getCachedPlanLimits("11111111-1111-4111-8111-111111111111");
  assert.deepEqual(cached, limits);
});

test("RedisWorkspaceMeteringService caches usage snapshot on miss", async () => {
  const mini = new MiniRedis();
  let queryCalls = 0;
  const service = new RedisWorkspaceMeteringService(
    mini as unknown as Redis,
    {
      async findOne() {
        return null;
      },
      async query() {
        queryCalls += 1;
        return queryCalls === 1 ? [{ count: 2 }] : [{ count: 4 }];
      },
    } as never,
  );

  const usage = await service.getCachedUsageSnapshot("22222222-2222-4222-8222-222222222222");
  assert.equal(usage.activeTours, 2);
  assert.equal(usage.users, 4);
  assert.ok(mini.data.has("tenant:plan:usage:22222222-2222-4222-8222-222222222222"));

  queryCalls = 0;
  await service.getCachedUsageSnapshot("22222222-2222-4222-8222-222222222222");
  assert.equal(queryCalls, 0);
});
