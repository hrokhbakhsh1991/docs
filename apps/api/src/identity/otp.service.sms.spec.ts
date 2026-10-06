import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { decryptOtpDeliveryCode } from "./otp-delivery-secret";
import {
  createMobileOtpChallenge,
  verifyMobileOtp,
  type OtpDeliveryContext,
} from "./otp.service";
import { InMemoryIdentityRepository } from "./in-memory-identity.repository";

const ENV_NAMES = [
  "NODE_ENV",
  "APP_INFRA_PROFILE",
  "ALLOW_PRODUCTION_STATIC_OTP",
  "AUTH_ALLOW_DEV_STATIC_OTP",
  "SMS_OTP_ENABLED",
  "SMS_DELIVERY_ENCRYPTION_KEY",
] as const;
const environment = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of ENV_NAMES) {
    const value = environment[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("real OTP SMS enqueue", () => {
  it("queues encrypted static OTP 1234 for the workspace-scoped Melipayamak connection", async () => {
    process.env.NODE_ENV = "production";
    process.env.APP_INFRA_PROFILE = "production";
    process.env.ALLOW_PRODUCTION_STATIC_OTP = "true";
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
    process.env.SMS_OTP_ENABLED = "true";
    process.env.SMS_DELIVERY_ENCRYPTION_KEY = "22".repeat(32);

    const repo = new InMemoryIdentityRepository();
    const jobs: Array<{ provider: string; capability: string; payload: Record<string, unknown> }> = [];
    const context: OtpDeliveryContext = {
      tenantId: "tenant-denali",
      workspaceType: "denali",
      purpose: "member_login",
    };
    const result = await createMobileOtpChallenge(
      "+989121234567",
      repo,
      context,
      {
        resolveConnection: async () => ({
          id: "connection-melipayamak",
          tenantId: context.tenantId,
          workspaceType: context.workspaceType,
          provider: "melipayamak",
          status: "enabled",
          enabled: true,
          capabilities: ["sms.send"],
          config: { bodyId: "98765" },
          secretRef: "secret-melipayamak",
          credentials: {},
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }),
        enqueueJob: async (input) => {
          jobs.push(input);
          return true;
        },
      }
    );

    assert.equal(jobs.length, 1);
    const job = jobs[0];
    assert.equal(job?.provider, "melipayamak");
    assert.equal(job?.capability, "sms.send");
    const payload = job?.payload ?? {};
    assert.equal(payload.recipient, "+989121234567");
    assert.equal(payload.smsTemplateId, "98765");
    assert.equal(payload.smsEncryptedVariables?.toString().includes("1234"), false);
    assert.equal(
      decryptOtpDeliveryCode(String(payload.smsEncryptedVariables)),
      "1234"
    );
    await verifyMobileOtp(result.challengeId, "1234", repo);
  });
});
