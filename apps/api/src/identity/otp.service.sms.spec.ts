import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { decryptOtpDeliveryCode } from "./otp-delivery-secret";
import { createMobileOtpChallenge, verifyMobileOtp, type OtpDeliveryContext } from "./otp.service";
import { InMemoryIdentityRepository } from "./in-memory-identity.repository";

const ENV_NAMES = [
  "NODE_ENV",
  "APP_INFRA_PROFILE",
  "ALLOW_PRODUCTION_STATIC_OTP",
  "AUTH_ALLOW_DEV_STATIC_OTP",
  "SMS_OTP_ENABLED",
  "SMS_DELIVERY_ENCRYPTION_KEY",
  "STAGING_ALLOW_STATIC_OTP",
  "OTP_FIXTURE_CODE",
  "SMS_PROVIDER_MODE",
  "MELIPAYAMAK_USERNAME",
  "MELIPAYAMAK_API_KEY",
  "SMS_OTP_TEMPLATE_ID",
  "SMS_OTP_TEMPLATE_SCOPE",
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
  it("uses platform credentials without resolving a tenant connection", async () => {
    process.env.NODE_ENV = "production";
    process.env.APP_INFRA_PROFILE = "production";
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = "false";
    process.env.ALLOW_PRODUCTION_STATIC_OTP = "false";
    process.env.SMS_OTP_ENABLED = "true";
    process.env.SMS_PROVIDER_MODE = "platform";
    process.env.MELIPAYAMAK_USERNAME = "test-user";
    process.env.MELIPAYAMAK_API_KEY = "test-key";
    process.env.SMS_OTP_TEMPLATE_ID = "98765";
    process.env.SMS_OTP_TEMPLATE_SCOPE = "denali";
    process.env.SMS_DELIVERY_ENCRYPTION_KEY = "22".repeat(32);

    let payload: Record<string, unknown> | undefined;
    await createMobileOtpChallenge(
      "+989121234571",
      new InMemoryIdentityRepository(),
      { tenantId: "tenant-a", workspaceType: "denali", purpose: "operator_login" },
      {
        assertPlatformBudget: async () => {},
        resolveConnection: async () => { throw new Error("tenant connection should not be used"); },
        enqueueJob: async (job) => { payload = job.payload; return true; },
      }
    );
    assert.equal(payload?.smsDeliverySource, "platform");
    assert.equal(payload?.smsTemplateId, "98765");
    assert.equal(payload?.integrationConnectionId, undefined);
    assert.equal(JSON.stringify(payload).includes("test-key"), false);
    await assert.rejects(
      () => createMobileOtpChallenge("+989121234574", new InMemoryIdentityRepository(),
        { tenantId: "tenant-b", workspaceType: "urban", purpose: "member_login" }),
      /PLATFORM_SMS_TEMPLATE_SCOPE_MISMATCH/
    );
  });

  it("fails closed in platform mode when delivery is disabled or static OTP is enabled", async () => {
    process.env.NODE_ENV = "production";
    process.env.APP_INFRA_PROFILE = "production";
    process.env.SMS_PROVIDER_MODE = "platform";
    process.env.SMS_OTP_ENABLED = "false";
    const context: OtpDeliveryContext = { tenantId: "tenant-a", workspaceType: "denali", purpose: "operator_login" };
    await assert.rejects(() => createMobileOtpChallenge("+989121234572", new InMemoryIdentityRepository(), context), /PLATFORM_SMS_DELIVERY_DISABLED/);
    process.env.SMS_OTP_ENABLED = "true";
    process.env.ALLOW_PRODUCTION_STATIC_OTP = "true";
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
    await assert.rejects(() => createMobileOtpChallenge("+989121234573", new InMemoryIdentityRepository(), context), /PLATFORM_SMS_STATIC_OTP_FORBIDDEN/);
  });
  it("queues encrypted static OTP 1234 for the workspace-scoped Melipayamak connection", async () => {
    process.env.NODE_ENV = "production";
    process.env.APP_INFRA_PROFILE = "production";
    process.env.ALLOW_PRODUCTION_STATIC_OTP = "true";
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
    process.env.SMS_OTP_ENABLED = "true";
    process.env.SMS_DELIVERY_ENCRYPTION_KEY = "22".repeat(32);

    const repo = new InMemoryIdentityRepository();
    const jobs: Array<{ provider: string; capability: string; payload: Record<string, unknown> }> =
      [];
    const context: OtpDeliveryContext = {
      tenantId: "tenant-denali",
      workspaceType: "denali",
      purpose: "member_login",
    };
    const result = await createMobileOtpChallenge("+989121234567", repo, context, {
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
      resolveWorkspaceName: async () => "دنالی تور",
    });

    assert.equal(jobs.length, 1);
    const job = jobs[0];
    assert.equal(job?.provider, "melipayamak");
    assert.equal(job?.capability, "sms.send");
    const payload = job?.payload ?? {};
    assert.equal(payload.recipient, "+989121234567");
    assert.equal(payload.smsTemplateId, "98765");
    assert.equal(payload.smsWorkspaceName, "دنالی تور");
    assert.equal(payload.smsEncryptedVariables?.toString().includes("1234"), false);
    assert.equal(decryptOtpDeliveryCode(String(payload.smsEncryptedVariables)), "1234");
    await verifyMobileOtp(result.challengeId, "1234", repo);
  });
});

describe("random SMS challenge contract", () => {
  for (const purpose of ["operator_login", "member_login"] as const) {
    it(`issues and verifies a complete four-digit code for ${purpose}`, async () => {
      process.env.NODE_ENV = "production";
      process.env.APP_INFRA_PROFILE = "staging";
      process.env.STAGING_ALLOW_STATIC_OTP = "false";
      process.env.AUTH_ALLOW_DEV_STATIC_OTP = "false";
      process.env.SMS_OTP_ENABLED = "true";
      process.env.SMS_DELIVERY_ENCRYPTION_KEY = "33".repeat(32);
      const repo = new InMemoryIdentityRepository();
      let delivered = "";
      const result = await createMobileOtpChallenge(
        "+989121234568",
        repo,
        {
          tenantId: "tenant-denali",
          workspaceType: "denali",
          purpose,
        },
        {
          resolveConnection: async () => ({
            id: "sms-connection",
            tenantId: "tenant-denali",
            workspaceType: "denali",
            provider: "melipayamak",
            status: "enabled",
            enabled: true,
            capabilities: ["sms.send"],
            config: { sender: "50000000000000" },
            secretRef: "sms-secret",
            credentials: {},
            createdAt: new Date(0),
            updatedAt: new Date(0),
          }),
          resolveWorkspaceName: async () => "دنالی",
          enqueueJob: async (job) => {
            delivered = decryptOtpDeliveryCode(String(job.payload.smsEncryptedVariables));
            assert.equal(job.payload.smsPurpose, purpose);
            return true;
          },
        }
      );
      assert.equal(result.otpLength, 4);
      assert.match(delivered, /^\d{4}$/);
      assert.equal("code" in result, false);
      await assert.rejects(() => verifyMobileOtp(result.challengeId, delivered.slice(0, 3), repo));
      await verifyMobileOtp(result.challengeId, delivered, repo);
      await assert.rejects(() => verifyMobileOtp(result.challengeId, delivered, repo));
    });
  }
});

describe("single-use OTP under simultaneous verification", () => {
  it("allows exactly one successful verification of the same challenge", async () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
    process.env.SMS_OTP_ENABLED = "false";
    const repo = new InMemoryIdentityRepository();
    const { challengeId } = await createMobileOtpChallenge("+989121234569", repo);
    const results = await Promise.allSettled([
      verifyMobileOtp(challengeId, "1234", repo),
      verifyMobileOtp(challengeId, "1234", repo),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  });
});

describe("OTP verification attempt limit", () => {
  it("invalidates a challenge after five incorrect guesses", async () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = "false";
    process.env.SMS_OTP_ENABLED = "false";
    process.env.OTP_FIXTURE_CODE = "1234";
    const repo = new InMemoryIdentityRepository();
    const { challengeId } = await createMobileOtpChallenge("+989121234570", repo);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await assert.rejects(() => verifyMobileOtp(challengeId, "0000", repo));
    }
    await assert.rejects(() => verifyMobileOtp(challengeId, "1234", repo));
  });
});
