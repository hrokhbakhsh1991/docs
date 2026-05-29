import type { INestApplication } from "@nestjs/common";

import { E2E_DEV_OTP, loginOtp } from "./auth/auth-session.factory";

export { E2E_DEV_OTP };

export async function webSessionOtpToken(
  app: INestApplication,
  params: { phone: string; tenantSubdomain: string; otp?: string },
): Promise<string> {
  return loginOtp(app, params);
}
