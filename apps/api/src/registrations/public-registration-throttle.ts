import { RateLimiterMemory } from "rate-limiter-flexible";

export class PublicRegistrationThrottleExceededError extends Error {
  readonly code = "PUBLIC_REGISTRATION_THROTTLE_EXCEEDED" as const;
  readonly statusCode = 429 as const;

  constructor(message = "Public registration rate limit exceeded") {
    super(message);
    this.name = "PublicRegistrationThrottleExceededError";
  }
}

export function isPublicRegistrationThrottleExceededError(
  error: unknown
): error is PublicRegistrationThrottleExceededError {
  return error instanceof PublicRegistrationThrottleExceededError;
}

function resolvePublicRegistrationThrottlePerMinute(): number {
  const raw = process.env.PUBLIC_REGISTRATION_THROTTLE_PER_MIN?.trim();
  if (!raw) {
    return 10;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }
  return parsed;
}

let limiter = new RateLimiterMemory({
  points: resolvePublicRegistrationThrottlePerMinute(),
  duration: 60,
});

function resolveClientIp(raw: string | undefined): string {
  if (raw === undefined || raw.trim().length === 0) {
    return "unknown";
  }
  return raw.split(",")[0]?.trim() || "unknown";
}

/**
 * P5-E-N-003 REG-03 — IP throttle for public registration ingress.
 */
export async function assertPublicRegistrationThrottle(
  clientIp: string | undefined
): Promise<void> {
  const key = resolveClientIp(clientIp);
  try {
    await limiter.consume(key);
  } catch {
    throw new PublicRegistrationThrottleExceededError();
  }
}

/** Test seam — reset throttle state between specs. */
export function resetPublicRegistrationThrottleForTests(): void {
  limiter = new RateLimiterMemory({
    points: resolvePublicRegistrationThrottlePerMinute(),
    duration: 60,
  });
}
