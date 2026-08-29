import { isValidIranMobile, toIranMobileE164 } from "@app-tour/iran-mobile";

import { logger } from "../observability/logger";

function resolveProviderMobile(mobile: string): string {
  if (isValidIranMobile(mobile)) {
    return toIranMobileE164(mobile);
  }
  return mobile;
}

export function deliverOtpCode(mobile: string, code: string): void {
  const providerMobile = resolveProviderMobile(mobile);
  void providerMobile;
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
