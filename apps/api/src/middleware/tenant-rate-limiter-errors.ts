import { RateLimiterRes } from "rate-limiter-flexible";

export class TenantRateLimitExceededError extends Error {
  readonly code = "RATE_LIMIT_EXCEEDED" as const;

  constructor(readonly retryAfterMs: number) {
    super("RATE_LIMIT_EXCEEDED");
    this.name = "TenantRateLimitExceededError";
  }
}

/** DEC-083 — Redis store unreachable when policy is fail_closed. */
export class RateLimiterRedisUnavailableError extends Error {
  readonly code = "RATE_LIMITER_REDIS_UNAVAILABLE" as const;

  constructor() {
    super("RATE_LIMITER_REDIS_UNAVAILABLE");
    this.name = "RateLimiterRedisUnavailableError";
  }
}

export function isRateLimiterRejected(error: unknown): error is RateLimiterRes {
  return error instanceof RateLimiterRes;
}

export function isRateLimiterRedisUnavailableError(
  error: unknown
): error is RateLimiterRedisUnavailableError {
  return error instanceof RateLimiterRedisUnavailableError;
}
