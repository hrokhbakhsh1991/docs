const OTP_REQUEST_LIMIT = 10;
const OTP_REQUEST_WINDOW_MS = 60_000;

type RateLimitBucket = {
  count: number;
  windowStartedAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export class OtpRateLimitedError extends Error {
  readonly code = "OTP_RATE_LIMITED";

  constructor() {
    super("OTP_RATE_LIMITED");
    this.name = "OtpRateLimitedError";
  }
}

export function resetOtpRateLimitForTests(): void {
  buckets.clear();
}

export function assertOtpRequestRateLimit(mobile: string): void {
  const key = mobile.trim();
  if (key.length === 0) {
    return;
  }
  const now = Date.now();
  const current = buckets.get(key);
  if (current === undefined || now - current.windowStartedAt >= OTP_REQUEST_WINDOW_MS) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return;
  }
  if (current.count >= OTP_REQUEST_LIMIT) {
    throw new OtpRateLimitedError();
  }
  current.count += 1;
}
