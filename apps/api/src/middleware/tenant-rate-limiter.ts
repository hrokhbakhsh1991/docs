import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";

import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

import { RedisRateLimiterStore } from "./redis-rate-limiter-store";

import { getPrismaAdmin } from "../db/prisma";
import { sendJson } from "../http/json";
import { requireActiveTenantId } from "../tenant/tenant-request-context";
import { isPersistedTenantUuid } from "../tenant/tenant-id-format";
import { findTenantById, isStaticTenantRegistryAllowed } from "../tenant/tenant-registry";

/**
 * Swappable backing store for per-tenant rate limits.
 * Phase 7.6 replaces {@link MemoryRateLimiterStore} with Redis (`RateLimiterRedis`)
 * while keeping the same `consume(tenantId)` contract — see DEC-015 / rate-limiting.md.
 */
export interface RateLimiterStore {
  consume(
    tenantKey: string,
    options?: { readonly points: number; readonly durationSec: number }
  ): Promise<void>;
}

export type TenantRateLimitConfig = {
  readonly enabled: boolean;
  readonly points: number;
  readonly durationSec: number;
};

export type TenantRateLimitTier = "read" | "write";

export function resolveTenantRateLimitConfig(
  env: NodeJS.ProcessEnv = process.env,
  tier: TenantRateLimitTier = "write"
): TenantRateLimitConfig {
  const enabled = env.TENANT_RATE_LIMIT_ENABLED?.trim().toLowerCase() !== "false";
  const pointsRaw =
    tier === "read"
      ? (env.TENANT_RATE_LIMIT_READ_POINTS ?? env.TENANT_RATE_LIMIT_POINTS ?? "50")
      : (env.TENANT_RATE_LIMIT_POINTS ?? "50");
  const points = Number.parseInt(pointsRaw, 10);
  const durationSec = Number.parseInt(env.TENANT_RATE_LIMIT_DURATION_SEC ?? "1", 10);
  return {
    enabled:
      enabled &&
      Number.isFinite(points) &&
      points > 0 &&
      Number.isFinite(durationSec) &&
      durationSec > 0,
    points: Number.isFinite(points) && points > 0 ? points : 50,
    durationSec: Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 1,
  };
}

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
  const normalized = tenantId.trim();

  if (isStaticTenantRegistryAllowed()) {
    const registered = findTenantById(normalized);
    if (registered !== null) {
      const rps = parseRateLimitRpsFromTheme(registered.theme);
      if (rps !== undefined) {
        return { points: Math.floor(rps), durationSec: base.durationSec };
      }
    }
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return { points: base.points, durationSec: base.durationSec };
  }

  if (!isPersistedTenantUuid(normalized)) {
    return { points: base.points, durationSec: base.durationSec };
  }

  const row = await getPrismaAdmin().tenant.findUnique({
    where: { id: normalized },
    select: { theme: true },
  });
  if (row !== null) {
    const rps = parseRateLimitRpsFromTheme(row.theme);
    if (rps !== undefined) {
      return { points: Math.floor(rps), durationSec: base.durationSec };
    }
  }

  return { points: base.points, durationSec: base.durationSec };
}

function isRateLimiterRejected(error: unknown): error is RateLimiterRes {
  return error instanceof RateLimiterRes;
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

export class TenantRateLimitExceededError extends Error {
  readonly code = "RATE_LIMIT_EXCEEDED" as const;

  constructor(readonly retryAfterMs: number) {
    super("RATE_LIMIT_EXCEEDED");
    this.name = "TenantRateLimitExceededError";
  }
}

let sharedStore: RateLimiterStore | undefined;

export function getTenantRateLimiterStore(
  config: TenantRateLimitConfig = resolveTenantRateLimitConfig()
): RateLimiterStore | null {
  if (!config.enabled) {
    return null;
  }
  if (sharedStore === undefined) {
    const redisUrl = process.env.REDIS_URL?.trim();
    sharedStore =
      redisUrl !== undefined && redisUrl.length > 0
        ? new RedisRateLimiterStore(redisUrl, config)
        : new MemoryRateLimiterStore(config);
  }
  return sharedStore;
}

/** Test-only — reset singleton between node:test files. */
export function resetTenantRateLimiterStoreForTests(): void {
  sharedStore = undefined;
}

/**
 * Consumes one point for the active tenant ALS id.
 * Caller must bind tenant ALS first (`runWithHttpRequestContext` / `runWithTenantContext`).
 */
function rateLimitConsumerKey(tenantId: string, tier: TenantRateLimitTier): string {
  return `${tenantId}:${tier}`;
}

export async function consumeTenantRateLimit(
  tier: TenantRateLimitTier = "write",
  config: TenantRateLimitConfig = resolveTenantRateLimitConfig(process.env, tier)
): Promise<void> {
  const store = getTenantRateLimiterStore(config);
  if (store === null) {
    return;
  }
  const tenantId = requireActiveTenantId();
  const effective = await resolveEffectiveRateLimitForTenant(tenantId, config);
  await store.consume(rateLimitConsumerKey(tenantId, tier), effective);
}

export function sendTenantRateLimitExceeded(
  res: ServerResponse,
  retryAfterMs = 0,
  correlationId?: string
): void {
  const retryAfterSec = retryAfterMs > 0 ? Math.ceil(retryAfterMs / 1000) : 1;
  res.setHeader("Retry-After", String(retryAfterSec));
  const id = correlationId ?? randomUUID();
  res.setHeader("x-correlation-id", id);
  sendJson(res, 429, {
    error: "Rate limit exceeded",
    code: "RATE_LIMIT_EXCEEDED",
    retryAfter: String(retryAfterSec),
    correlationId: id,
  });
}
