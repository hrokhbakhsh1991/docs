import { isProductionAuthMode } from "../tenant-kernel/auth-env";

import type { TenantRateLimitConfig, TenantRateLimitTier } from "./tenant-rate-limiter-types";

export const PRODUCTION_REDIS_URL_REQUIRED = "PRODUCTION_REDIS_URL_REQUIRED";

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
 * Fail-closed: production with rate limiting enabled must use Redis store (DEC-065 / SCAL-DEBT-04).
 */
export function assertProductionRedisUrl(env: NodeJS.ProcessEnv = process.env): void {
  if (!isProductionAuthMode()) {
    return;
  }
  const config = resolveTenantRateLimitConfig(env);
  if (!config.enabled) {
    return;
  }
  const redisUrl = env.REDIS_URL?.trim();
  if (redisUrl === undefined || redisUrl.length === 0) {
    throw new Error(PRODUCTION_REDIS_URL_REQUIRED);
  }
}
