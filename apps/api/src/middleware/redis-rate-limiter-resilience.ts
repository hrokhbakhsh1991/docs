import type { TenantRateLimitTier } from "./tenant-rate-limiter-types";

export type RedisFailurePolicy = "fail_closed" | "fail_local" | "fail_open";

const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 30_000;

let consecutiveRedisFailures = 0;
let circuitOpenUntilMs = 0;

export function resetRedisRateLimiterCircuitForTests(): void {
  consecutiveRedisFailures = 0;
  circuitOpenUntilMs = 0;
}

export function isRedisRateLimiterCircuitOpen(nowMs = Date.now()): boolean {
  return nowMs < circuitOpenUntilMs;
}

export function recordRedisRateLimiterFailure(nowMs = Date.now()): void {
  consecutiveRedisFailures += 1;
  if (consecutiveRedisFailures >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitOpenUntilMs = nowMs + CIRCUIT_OPEN_MS;
    consecutiveRedisFailures = 0;
  }
}

export function recordRedisRateLimiterSuccess(): void {
  consecutiveRedisFailures = 0;
}

export function parseTierFromConsumerKey(tenantKey: string): TenantRateLimitTier {
  const suffix = tenantKey.split(":").at(-1);
  return suffix === "read" ? "read" : "write";
}

export function resolveRedisFailurePolicy(
  tier: TenantRateLimitTier,
  env: NodeJS.ProcessEnv = process.env
): RedisFailurePolicy {
  const explicit = env.TENANT_RATE_LIMIT_REDIS_FAILURE_POLICY?.trim().toLowerCase();
  if (explicit === "fail_closed" || explicit === "fail_local" || explicit === "fail_open") {
    return explicit;
  }
  return tier === "read" ? "fail_open" : "fail_local";
}

function errorChainMessages(error: unknown): string[] {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current !== undefined; depth += 1) {
    if (current instanceof Error) {
      messages.push(current.message.toLowerCase());
      current = current.cause;
      continue;
    }
    messages.push(String(current).toLowerCase());
    break;
  }
  return messages;
}

export function isRedisInfrastructureError(error: unknown): boolean {
  const haystack = errorChainMessages(error).join(" ");
  return (
    haystack.includes("redis") ||
    haystack.includes("econnrefused") ||
    haystack.includes("enotfound") ||
    haystack.includes("etimedout") ||
    haystack.includes("connection is closed") ||
    haystack.includes("maxretriesperrequest") ||
    haystack.includes("reached the max retries") ||
    haystack.includes("connect")
  );
}
