import Redis from "ioredis";
import { createHmac } from "node:crypto";
import { OtpRateLimitedError } from "./otp-rate-limit";

const SCRIPT = `
  for i = 1, 3 do
    if tonumber(redis.call('GET', KEYS[i]) or '0') >= tonumber(ARGV[i]) then return 0 end
  end
  for i = 1, 3 do
    local count = redis.call('INCR', KEYS[i])
    if count == 1 then redis.call('EXPIRE', KEYS[i], 120) end
  end
  return 1
`;

let cached: { url: string; client: Redis } | undefined;

function positiveLimit(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  if (!/^\d+$/.test(raw.trim())) throw new Error("PLATFORM_SMS_RATE_LIMIT_INVALID");
  const result = Number(raw);
  if (!Number.isSafeInteger(result) || result < 1)
    throw new Error("PLATFORM_SMS_RATE_LIMIT_INVALID");
  return result;
}

export async function assertPlatformOtpRateLimit(
  tenantId: string | null,
  mobile: string
): Promise<void> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error("PLATFORM_SMS_RATE_LIMIT_UNAVAILABLE");
  const tenantLimit = positiveLimit(process.env.SMS_OTP_TENANT_RATE_PER_MINUTE, 30);
  const globalLimit = positiveLimit(process.env.SMS_OTP_GLOBAL_RATE_PER_MINUTE, 120);
  const mobileLimit = positiveLimit(process.env.SMS_OTP_MOBILE_RATE_PER_MINUTE, 10);
  const key = process.env.SMS_DELIVERY_ENCRYPTION_KEY?.trim();
  if (!key) throw new Error("PLATFORM_SMS_ENCRYPTION_KEY_INVALID");
  const mobileHash = createHmac("sha256", key).update(mobile.trim()).digest("hex");
  if (cached === undefined || cached.url !== url) {
    cached?.client.disconnect();
    const client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 500,
      retryStrategy: () => null,
    });
    client.on("error", () => {});
    cached = { url, client };
  }
  const namespace =
    process.env.APP_INFRA_PROFILE?.trim() || process.env.NODE_ENV?.trim() || "development";
  const minute = Math.floor(Date.now() / 60_000);
  try {
    if (cached.client.status === "wait") await cached.client.connect();
    const scope = tenantId === null ? "platform" : `tenant:${tenantId}`;
    const result = await cached.client.eval(
      SCRIPT,
      3,
      `otp-budget:${namespace}:${minute}:${scope}`,
      `otp-budget:${namespace}:${minute}:global`,
      `otp-budget:${namespace}:${minute}:mobile:${mobileHash}`,
      tenantLimit,
      globalLimit,
      mobileLimit
    );
    if (result !== 1) throw new OtpRateLimitedError();
  } catch (error) {
    if (error instanceof OtpRateLimitedError) throw error;
    cached.client.disconnect();
    cached = undefined;
    throw new Error("PLATFORM_SMS_RATE_LIMIT_UNAVAILABLE");
  }
}
