import Redis from "ioredis";
import { RateLimiterRedis } from "rate-limiter-flexible";

import type { RateLimiterStore, TenantRateLimitConfig } from "./tenant-rate-limiter-types";
import {
  isRateLimiterRejected,
  RateLimiterRedisUnavailableError,
  TenantRateLimitExceededError,
} from "./tenant-rate-limiter-errors";
import {
  isRedisInfrastructureError,
  isRedisRateLimiterCircuitOpen,
  parseTierFromConsumerKey,
  recordRedisRateLimiterFailure,
  recordRedisRateLimiterSuccess,
  resolveRedisFailurePolicy,
  type RedisFailurePolicy,
} from "./redis-rate-limiter-resilience";
import { metricsRegistry } from "../observability/metrics";

function limiterConfigKey(points: number, durationSec: number): string {
  return `${points}:${durationSec}`;
}

/**
 * Redis-backed per-tenant token bucket with runtime fallback (DEC-083).
 */
export class RedisRateLimiterStore implements RateLimiterStore {
  private readonly redisClient: Redis;
  private readonly limiters = new Map<string, RateLimiterRedis>();

  constructor(
    redisUrl: string,
    private readonly defaultConfig: TenantRateLimitConfig,
    private readonly localFallback: RateLimiterStore
  ) {
    this.redisClient = new Redis(redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 500,
      lazyConnect: true,
      // No background reconnect — circuit + per-consume retry; avoids test/process hang on bad URL.
      retryStrategy: () => null,
    });
    this.redisClient.on("error", () => {
      // Swallow connection blips — consume() maps to tiered fallback (DEC-083).
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

  private async consumeLocal(
    tenantKey: string,
    options?: { readonly points: number; readonly durationSec: number }
  ): Promise<void> {
    metricsRegistry.increment("rate_limiter_redis_fallback_total");
    await this.localFallback.consume(tenantKey, options);
  }

  private async applyRedisFailurePolicy(
    policy: RedisFailurePolicy,
    tenantKey: string,
    options?: { readonly points: number; readonly durationSec: number }
  ): Promise<void> {
    if (policy === "fail_open") {
      metricsRegistry.increment("rate_limiter_redis_fallback_total");
      return;
    }
    if (policy === "fail_local") {
      await this.consumeLocal(tenantKey, options);
      return;
    }
    throw new RateLimiterRedisUnavailableError();
  }

  async consume(
    tenantKey: string,
    options?: { readonly points: number; readonly durationSec: number }
  ): Promise<void> {
    const tier = parseTierFromConsumerKey(tenantKey);
    const policy = resolveRedisFailurePolicy(tier);

    if (isRedisRateLimiterCircuitOpen()) {
      await this.applyRedisFailurePolicy(policy, tenantKey, options);
      return;
    }

    const points = options?.points ?? this.defaultConfig.points;
    const durationSec = options?.durationSec ?? this.defaultConfig.durationSec;
    const limiter = this.getLimiter(points, durationSec);

    try {
      await limiter.consume(tenantKey, 1);
      recordRedisRateLimiterSuccess();
    } catch (error) {
      if (isRateLimiterRejected(error)) {
        throw new TenantRateLimitExceededError(error.msBeforeNext ?? 0);
      }
      if (!isRedisInfrastructureError(error) && policy === "fail_closed") {
        throw error;
      }
      recordRedisRateLimiterFailure();
      await this.applyRedisFailurePolicy(policy, tenantKey, options);
    }
  }

  /** Close ioredis client — required in tests to avoid open-handle hangs on process exit. */
  async disconnect(): Promise<void> {
    this.redisClient.removeAllListeners();
    if (this.redisClient.status === "end") {
      return;
    }
    try {
      await this.redisClient.quit();
    } catch {
      this.redisClient.disconnect();
    }
  }
}
