import { logger } from "../observability/logger";

export function deliverOtpCode(mobile: string, code: string): void {
  void mobile;
  void code;
  if (process.env.RESEND_API_KEY?.trim()) {
    return;
  }
  const nodeEnv = process.env.NODE_ENV?.trim();
  if (nodeEnv !== "development" && nodeEnv !== "test") {
    return;
  }
  logger.info({ event: "otp.delivery.dev_fallback" }, "otp.delivery.dev_fallback");
}
