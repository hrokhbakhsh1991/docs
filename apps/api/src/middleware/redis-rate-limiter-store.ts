import Redis from "ioredis";
import { RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";

import type { RateLimiterStore, TenantRateLimitConfig } from "./tenant-rate-limiter";
import { TenantRateLimitExceededError } from "./tenant-rate-limiter";

function isRateLimiterRejected(error: unknown): error is RateLimiterRes {
  return error instanceof RateLimiterRes;
}

function limiterConfigKey(points: number, durationSec: number): string {
  return `${points}:${durationSec}`;
}

/**
 * Redis-backed per-tenant token bucket (Phase 7.6 / P1-1).
 * Requires `REDIS_URL` — use only when set; see `getTenantRateLimiterStore`.
 */
export class RedisRateLimiterStore implements RateLimiterStore {
  private readonly redisClient: Redis;
  private readonly limiters = new Map<string, RateLimiterRedis>();

  constructor(
    redisUrl: string,
    private readonly defaultConfig: TenantRateLimitConfig
  ) {
    this.redisClient = new Redis(redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
  }

  private getLimiter(points: number, durationSec: number): RateLimiterRedis {
    const key = limiterConfigKey(points, durationSec);
    let limiter = this.limiters.get(key);
    if (limiter === undefined) {
      limiter = new RateLimiterRedis({
        storeClient: this.redisClient,
        points,
        duration: durationSec,
        keyPrefix: "ratelimit",
      });
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
