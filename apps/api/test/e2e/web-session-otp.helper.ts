import assert from "node:assert/strict";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { tenantTestHost } from "./tenant-test-host";

/** Non-production test OTP; matches `AuthService.validatePhoneOtp` outside `production`. */
export const E2E_DEV_OTP = "1234";

export async function webSessionOtpToken(
  app: INestApplication,
  params: { phone: string; tenantSubdomain: string; otp?: string }
): Promise<string> {
  const otp = params.otp ?? E2E_DEV_OTP;
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost(params.tenantSubdomain))
    .send({ phone: params.phone, otp });
  assert.equal(
    response.status,
    200,
    `POST /api/v2/auth/web/session/otp expected 200, got ${response.status}: ${JSON.stringify(response.body)}`
  );
  assert.equal(typeof response.body.session_token, "string");
  assert.ok((response.body.session_token as string).length > 20);
  return response.body.session_token as string;
}
