import type { ServerResponse } from "node:http";

import { RateLimiterMemory } from "rate-limiter-flexible";

import { sendJson } from "../http/json";
import { requireActiveTraceId } from "../observability/trace-request-context";
import { resolveTenantConnectionTier } from "../tenant/resolve-tenant-connection-tier";
import { resolveTenantThemeJsonById } from "../tenant/resolve-registered-tenant";
import { requireActiveTenantId } from "../tenant/tenant-request-context";
import { RedisRateLimiterStore } from "./redis-rate-limiter-store";
import { resolveTenantRateLimitConfig } from "./tenant-rate-limit-config";
import type {
  RateLimiterStore,
  TenantRateLimitConfig,
  TenantRateLimitTier,
} from "./tenant-rate-limiter-types";
import { isRateLimiterRejected, TenantRateLimitExceededError } from "./tenant-rate-limiter-errors";

export type {
  RateLimiterStore,
  TenantRateLimitConfig,
  TenantRateLimitTier,
} from "./tenant-rate-limiter-types";
export {
  assertConnectionTierRpmOrdering,
  assertProductionRedisUrl,
  PRODUCTION_REDIS_URL_REQUIRED,
  resolveConnectionTierRpm,
  resolveTenantRateLimitConfig,
} from "./tenant-rate-limit-config";

export type TenantRateLimitRoute = {
  readonly method: string;
  readonly path: string;
};

/**
 * Per-tenant RPS override from `tenants.theme` JSON.
 * Precedence: `theme.rateLimitRps` → `theme.featureFlags.rateLimitRps`.
 */
export function parseRateLimitRpsFromTheme(theme: unknown): number | undefined {
  if (theme === null || typeof theme !== "object") {
    return undefined;
  }
  const root = theme as Record<string, unknown>;
  const direct = root.rateLimitRps;
  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) {
    return direct;
  }
  const featureFlags = root.featureFlags;
  if (featureFlags !== null && typeof featureFlags === "object") {
    const nested = (featureFlags as Record<string, unknown>).rateLimitRps;
    if (typeof nested === "number" && Number.isFinite(nested) && nested > 0) {
      return nested;
    }
  }
  return undefined;
}

export async function resolveEffectiveRateLimitForTenant(
  tenantId: string,
  base: TenantRateLimitConfig = resolveTenantRateLimitConfig()
): Promise<{ readonly points: number; readonly durationSec: number }> {
  const theme = await resolveTenantThemeJsonById(tenantId);
  if (theme !== null) {
    const rps = parseRateLimitRpsFromTheme(theme);
    if (rps !== undefined) {
      return { points: Math.floor(rps), durationSec: base.durationSec };
    }
  }

  return { points: base.points, durationSec: base.durationSec };
}

function limiterConfigKey(points: number, durationSec: number): string {
  return `${points}:${durationSec}`;
}

/**
 * In-memory token bucket — independent counters per tenant key.
 * Separate `RateLimiterMemory` instances per (points, duration) pair for per-tenant overrides.
 */
export class MemoryRateLimiterStore implements RateLimiterStore {
  private readonly limiters = new Map<string, RateLimiterMemory>();

  constructor(private readonly defaultConfig: TenantRateLimitConfig) {}

  private getLimiter(points: number, durationSec: number): RateLimiterMemory {
    const key = limiterConfigKey(points, durationSec);
    let limiter = this.limiters.get(key);
    if (limiter === undefined) {
      limiter = new RateLimiterMemory({ points, duration: durationSec });
      this.limiters.set(key, limiter);
    }
    return limiter;
  }

  async consume(
    tenantKey: string,
    options?: { readonly points: number; readonly durationSec: number }
  ): Promise<void> {
    const points = options?.points ?? this.defaultConfig.points;
    const durationSec = options?.durationSec ?? this.defaultConfig.durationSec;
    const limiter = this.getLimiter(points, durationSec);
    try {
      await limiter.consume(tenantKey, 1);
    } catch (error) {
      if (isRateLimiterRejected(error)) {
        throw new TenantRateLimitExceededError(error.msBeforeNext ?? 0);
      }
      throw error;
    }
  }
}

export {
  isRateLimiterRedisUnavailableError,
  RateLimiterRedisUnavailableError,
  TenantRateLimitExceededError,
} from "./tenant-rate-limiter-errors";

let sharedStore: RateLimiterStore | undefined;

export function getTenantRateLimiterStore(
  config: TenantRateLimitConfig = resolveTenantRateLimitConfig()
): RateLimiterStore | null {
  if (!config.enabled) {
    return null;
  }
  if (sharedStore === undefined) {
    const redisUrl = process.env.REDIS_URL?.trim();
    const forceMemoryForTestHarness = Boolean(process.env.APPS_API_TEST_TIER?.trim());
    sharedStore =
      !forceMemoryForTestHarness && redisUrl !== undefined && redisUrl.length > 0
        ? new RedisRateLimiterStore(redisUrl, config, new MemoryRateLimiterStore(config))
        : new MemoryRateLimiterStore(config);
  }
  return sharedStore;
}

/** Test-only — reset singleton between node:test files. */
export async function resetTenantRateLimiterStoreForTests(): Promise<void> {
  if (sharedStore instanceof RedisRateLimiterStore) {
    await sharedStore.disconnect();
  }
  sharedStore = undefined;
}

/**
 * Redis key segment: `{tenantId}:{connectionTier}:{operationTier}:{method}:{path}`.
 * Prefix `ratelimit` applied by RateLimiterRedis (DEC-P7-006).
 */
export function rateLimitConsumerKey(
  tenantId: string,
  connectionTier: ReturnType<typeof resolveTenantConnectionTier>,
  operationTier: TenantRateLimitTier,
  route?: TenantRateLimitRoute
): string {
  const method = route?.method ?? "POST";
  const path = route?.path ?? "/tours";
  return `${tenantId}:${connectionTier}:${operationTier}:${method}:${path}`;
}

export async function consumeTenantRateLimit(
  tier: TenantRateLimitTier = "write",
  route?: TenantRateLimitRoute,
  config?: TenantRateLimitConfig
): Promise<void> {
  const tenantId = requireActiveTenantId();
  const connectionTier = resolveTenantConnectionTier(tenantId);
  const resolvedConfig = config ?? resolveTenantRateLimitConfig(process.env, tier, connectionTier);
  const store = getTenantRateLimiterStore(resolvedConfig);
  if (store === null) {
    return;
  }
  const effective = await resolveEffectiveRateLimitForTenant(tenantId, resolvedConfig);
  await store.consume(rateLimitConsumerKey(tenantId, connectionTier, tier, route), effective);
}

export function sendTenantRateLimitExceeded(
  res: ServerResponse,
  retryAfterMs = 0,
  requestId?: string
): void {
  const retryAfterSec = retryAfterMs > 0 ? Math.ceil(retryAfterMs / 1000) : 1;
  const retryAfterMsOut = retryAfterMs > 0 ? retryAfterMs : retryAfterSec * 1000;
  res.setHeader("Retry-After", String(retryAfterSec));
  const id = requestId ?? requireActiveTraceId();
  res.setHeader("x-correlation-id", id);
  sendJson(res, 429, {
    error: "rate_limit_exceeded",
    requestId: id,
    retryAfterMs: retryAfterMsOut,
  });
}
