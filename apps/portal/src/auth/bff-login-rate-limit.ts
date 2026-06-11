/**
 * BFF login rate limit — defense-in-depth before API OTP throttle.
 * @see docs/phase-9/appendices/identity-web-bff-addendum.md
 */
const BFF_LOGIN_LIMIT = 10;
const BFF_LOGIN_WINDOW_MS = 60_000;

type RateLimitBucket = {
  count: number;
  windowStartedAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export function resetBffLoginRateLimitForTests(): void {
  buckets.clear();
}

export function readBffLoginRateLimitKey(req: Request, phone?: string): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded ?? req.headers.get("x-real-ip")?.trim() ?? "unknown";
  let host = req.headers.get("host")?.trim() ?? "";
  if (host.length === 0) {
    try {
      host = new URL(req.url).host;
    } catch {
      host = "unknown-host";
    }
  }
  const scope = `${host}:${ip}`;
  const normalizedPhone = phone?.trim() ?? "";
  return normalizedPhone.length > 0 ? `${scope}:${normalizedPhone}` : scope;
}

export function assertBffLoginRateLimit(key: string): void {
  if (key.length === 0) {
    return;
  }
  const now = Date.now();
  const current = buckets.get(key);
  if (current === undefined || now - current.windowStartedAt >= BFF_LOGIN_WINDOW_MS) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return;
  }
  if (current.count >= BFF_LOGIN_LIMIT) {
    throw new Error("OTP_RATE_LIMITED");
  }
  current.count += 1;
}

export function checkBffLoginRateLimit(key: string): boolean {
  try {
    assertBffLoginRateLimit(key);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === "OTP_RATE_LIMITED") {
      return false;
    }
    throw error;
  }
}
