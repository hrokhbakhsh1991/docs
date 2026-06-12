import { logger } from "../observability/logger";

export function deliverOtpCode(mobile: string, code: string): void {
  if (process.env.RESEND_API_KEY?.trim()) {
    return;
  }
  if (process.env.NODE_ENV === "production") {
    return;
  }
  // Dev/staging without SMS provider — visible in API logs only (never returned in HTTP body).
  logger.info({ mobile: mobile.trim(), code }, "otp-dev delivery");
}
