import { isProductionAuthMode } from "../tenant-kernel/auth-env";
import type { TenantConnectionTier } from "../tenant/resolve-tenant-connection-tier";

import type { TenantRateLimitConfig, TenantRateLimitTier } from "./tenant-rate-limiter-types";

export const PRODUCTION_REDIS_URL_REQUIRED = "PRODUCTION_REDIS_URL_REQUIRED";

const RPM_WINDOW_SEC = 60;

export function resolveConnectionTierRpm(
  connectionTier: TenantConnectionTier,
  env: NodeJS.ProcessEnv = process.env
): number | undefined {
  const raw =
    connectionTier === "silo"
      ? (env.RATE_LIMIT_SILO_RPM ?? env.RATE_LIMIT_POOL_RPM)
      : env.RATE_LIMIT_POOL_RPM;
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const rpm = Number.parseInt(raw, 10);
  return Number.isFinite(rpm) && rpm > 0 ? rpm : undefined;
}

/** Pool RPM must not exceed silo RPM when both are explicitly set (DEC-P7-006). */
export function assertConnectionTierRpmOrdering(env: NodeJS.ProcessEnv = process.env): void {
  const poolRaw = env.RATE_LIMIT_POOL_RPM?.trim();
  const siloRaw = env.RATE_LIMIT_SILO_RPM?.trim();
  if (poolRaw === undefined || siloRaw === undefined) {
    return;
  }
  const pool = Number.parseInt(poolRaw, 10);
  const silo = Number.parseInt(siloRaw, 10);
  if (Number.isFinite(pool) && Number.isFinite(silo) && pool > silo) {
    throw new Error("RATE_LIMIT_POOL_RPM_MUST_NOT_EXCEED_SILO_RPM");
  }
}

export function resolveTenantRateLimitConfig(
  env: NodeJS.ProcessEnv = process.env,
  tier: TenantRateLimitTier = "write",
  connectionTier: TenantConnectionTier = "pool"
): TenantRateLimitConfig {
  const enabled = env.TENANT_RATE_LIMIT_ENABLED?.trim().toLowerCase() !== "false";
  const rpm = resolveConnectionTierRpm(connectionTier, env);
  const pointsRaw =
    rpm !== undefined
      ? String(rpm)
      : tier === "read"
        ? (env.TENANT_RATE_LIMIT_READ_POINTS ?? env.TENANT_RATE_LIMIT_POINTS ?? "50")
        : (env.TENANT_RATE_LIMIT_POINTS ?? "50");
  const points = Number.parseInt(pointsRaw, 10);
  const durationSec =
    rpm !== undefined
      ? RPM_WINDOW_SEC
      : Number.parseInt(env.TENANT_RATE_LIMIT_DURATION_SEC ?? "1", 10);
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
