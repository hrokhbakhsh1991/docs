import { OtpChallengeInvalidError, OtpExpiredError, OtpInvalidError } from "./identity.errors";
import { getIdentityRepository, type IdentityRepository } from "./create-identity-repository";
import { deliverOtpCode } from "./otp-delivery";
import { hashOtpCode, resolveOtpCodeForChallenge, verifyOtpCodeHash } from "./otp-code";
import { assertOtpRequestRateLimit } from "./otp-rate-limit";
import { isStaticOtpEnabled, STAGING_STATIC_OTP_CODE } from "./static-otp-policy";
import { encryptOtpDeliveryCode } from "./otp-delivery-secret";
import {
  enqueueOtpDeliveryJob,
  resolveOtpDeliveryConnection,
} from "../integrations/application/otp-delivery-dependencies";
import type { IntegrationConnectionRecord } from "../integrations/platform/integration-connection.types";
import type { EnqueueIntegrationDeliveryJobInput } from "../integrations/platform/integration-delivery.types";
import { resolveOtpWorkspaceName } from "./resolve-otp-workspace-name";
import { readPlatformSmsConfig } from "../integrations/application/platform-sms-config";
import { assertPlatformOtpRateLimit } from "./platform-otp-rate-limit";
import { canonicalizeLoginMobile } from "./canonicalize-login-mobile";
import { OTP_MAX_VERIFY_ATTEMPTS } from "./otp-constants";

const DEV_STATIC_OTP = STAGING_STATIC_OTP_CODE;

function isDevStaticOtpEnabled(): boolean {
  return isStaticOtpEnabled();
}

type OtpDeliveryBase = {
  readonly tenantId: string | null;
  readonly workspaceType: string;
};

export type OtpDeliveryContext = OtpDeliveryBase &
  (
    | { readonly purpose: "password_change"; readonly tenantId: string; readonly userId: string }
    | {
        readonly purpose:
          | "operator_login"
          | "member_login"
          | "mobile_change"
          | "invite"
          | "platform_ops_login";
      }
  );

export type OtpDeliveryDependencies = {
  readonly assertPlatformBudget?: (tenantId: string | null, mobile: string) => Promise<void>;
  readonly resolveConnection?: (input: {
    readonly tenantId: string;
    readonly workspaceType: string;
  }) => Promise<IntegrationConnectionRecord | null>;
  readonly enqueueJob?: (input: EnqueueIntegrationDeliveryJobInput) => Promise<boolean>;
  readonly resolveWorkspaceName?: (tenantId: string) => Promise<string | null>;
};

async function enqueueRealOtpDelivery(
  mobile: string,
  code: string,
  challengeId: string,
  context: OtpDeliveryContext,
  dependencies: OtpDeliveryDependencies = {}
): Promise<void> {
  const platformMode = process.env.SMS_PROVIDER_MODE?.trim() === "platform";
  if (platformMode && process.env.SMS_OTP_ENABLED?.trim() !== "true") {
    throw new Error("PLATFORM_SMS_DELIVERY_DISABLED");
  }
  if (process.env.SMS_OTP_ENABLED?.trim() !== "true") {
    deliverOtpCode(mobile, code);
    return;
  }
  if (platformMode && isDevStaticOtpEnabled()) throw new Error("PLATFORM_SMS_STATIC_OTP_FORBIDDEN");
  const platformScope = context.tenantId === null;
  if (
    platformScope &&
    (context.workspaceType !== "platform" || context.purpose !== "platform_ops_login")
  ) {
    throw new Error("PLATFORM_SMS_CONTEXT_INVALID");
  }
  const platformConfig = platformMode
    ? readPlatformSmsConfig(process.env, platformScope ? "platform" : "tenant")
    : null;
  if (
    platformConfig &&
    !platformScope &&
    platformConfig.workspaceScope !== "*" &&
    platformConfig.workspaceScope !== context.workspaceType
  ) {
    throw new Error("PLATFORM_SMS_TEMPLATE_SCOPE_MISMATCH");
  }
  if (context.tenantId === null && !platformMode) throw new Error("PLATFORM_SMS_MODE_REQUIRED");
  const connection = platformMode
    ? null
    : await (dependencies.resolveConnection ?? resolveOtpDeliveryConnection)({
        tenantId: context.tenantId!,
        workspaceType: context.workspaceType,
      });
  if (!platformMode && connection === null)
    throw new Error("MELIPAYAMAK_CONNECTION_NOT_CONFIGURED");
  const encryptedCode = encryptOtpDeliveryCode(code);
  const enqueueJob = dependencies.enqueueJob ?? enqueueOtpDeliveryJob;
  const workspaceName =
    platformMode || platformScope
      ? null
      : await (dependencies.resolveWorkspaceName ?? resolveOtpWorkspaceName)(context.tenantId!);
  const created = await enqueueJob({
    tenantId: context.tenantId,
    deliveryScope: platformScope ? "platform" : "tenant",
    provider: "melipayamak",
    capability: "sms.send",
    domainEventId: challengeId,
    eventType: "auth.otp.requested",
    payload: {
      workspaceType: context.workspaceType,
      ...(platformMode
        ? { smsDeliverySource: "platform" }
        : { integrationConnectionId: connection!.id }),
      recipient: mobile,
      smsPurpose: context.purpose,
      smsTemplateKey: "auth.otp",
      smsTemplateId:
        platformConfig?.config.bodyId ??
        (typeof connection?.config.bodyId === "string" ? connection.config.bodyId : ""),
      smsEncryptedVariables: encryptedCode,
      ...(workspaceName === null ? {} : { smsWorkspaceName: workspaceName }),
    },
  });
  if (!created) return;
}

export async function createMobileOtpChallenge(
  mobile: string,
  repo: IdentityRepository = getIdentityRepository(),
  deliveryContext?: OtpDeliveryContext,
  deliveryDependencies: OtpDeliveryDependencies = {}
): Promise<{ challengeId: string; otpLength: number }> {
  const platformOpsRequest = deliveryContext?.purpose === "platform_ops_login";
  if (
    deliveryContext?.purpose === "password_change" &&
    (typeof deliveryContext.tenantId !== "string" ||
      deliveryContext.tenantId.trim().length === 0 ||
      typeof deliveryContext.userId !== "string" ||
      deliveryContext.userId.trim().length === 0)
  ) {
    throw new Error("PASSWORD_OTP_SCOPE_INVALID");
  }
  if (
    platformOpsRequest !== (deliveryContext?.tenantId === null) ||
    (platformOpsRequest && deliveryContext?.workspaceType !== "platform")
  ) {
    throw new Error("PLATFORM_SMS_CONTEXT_INVALID");
  }
  if (platformOpsRequest && process.env.SMS_PROVIDER_MODE?.trim() !== "platform") {
    throw new Error("PLATFORM_SMS_MODE_REQUIRED");
  }
  assertOtpRequestRateLimit(mobile);
  if (process.env.SMS_PROVIDER_MODE?.trim() === "platform") {
    if (deliveryContext === undefined) throw new Error("PLATFORM_SMS_CONTEXT_REQUIRED");
    if (process.env.NODE_ENV !== "production" && process.env.OTP_FIXTURE_CODE?.trim()) {
      throw new Error("PLATFORM_SMS_FIXTURE_OTP_FORBIDDEN");
    }
    if (process.env.SMS_OTP_ENABLED?.trim() !== "true")
      throw new Error("PLATFORM_SMS_DELIVERY_DISABLED");
    if (isDevStaticOtpEnabled()) throw new Error("PLATFORM_SMS_STATIC_OTP_FORBIDDEN");
    const platformScope = deliveryContext.tenantId === null;
    if (
      platformScope &&
      (deliveryContext.workspaceType !== "platform" ||
        deliveryContext.purpose !== "platform_ops_login")
    ) {
      throw new Error("PLATFORM_SMS_CONTEXT_INVALID");
    }
    const config = readPlatformSmsConfig(process.env, platformScope ? "platform" : "tenant");
    if (
      !platformScope &&
      config.workspaceScope !== "*" &&
      config.workspaceScope !== deliveryContext.workspaceType
    ) {
      throw new Error("PLATFORM_SMS_TEMPLATE_SCOPE_MISMATCH");
    }
    await (deliveryDependencies.assertPlatformBudget ?? assertPlatformOtpRateLimit)(
      deliveryContext.tenantId,
      mobile
    );
  }
  // DL-44: when static DEV OTP is enabled, issue the same code the UI hints (1234)
  // so otp-dev logs match PUBLIC_REGISTRATION_DEV_OTP / otp.devHint.
  const code = isDevStaticOtpEnabled() ? DEV_STATIC_OTP : resolveOtpCodeForChallenge();
  const codeHash = await hashOtpCode(code);
  const scope =
    deliveryContext?.purpose === "password_change"
      ? {
          purpose: "password_change" as const,
          tenantId: deliveryContext.tenantId,
          userId: deliveryContext.userId,
        }
      : undefined;
  const { challengeId } = await repo.createOtpChallenge(mobile, codeHash, scope);
  if (deliveryContext === undefined) deliverOtpCode(mobile, code);
  else
    await enqueueRealOtpDelivery(mobile, code, challengeId, deliveryContext, deliveryDependencies);
  return { challengeId, otpLength: code.length };
}

export async function verifyMobileOtp(
  challengeId: string,
  code: string,
  repo: IdentityRepository = getIdentityRepository()
): Promise<{ mobile: string }> {
  const trimmedCode = typeof code === "string" ? code.trim() : "";
  if (trimmedCode.length === 0) {
    throw new OtpInvalidError();
  }

  const row = await repo.findOtpChallenge(challengeId);
  // A login OTP must never consume a challenge issued for another operation.
  // Credential-change challenges are handled by their own bound transaction.
  if (row === null || row.purpose !== "login") {
    throw new OtpChallengeInvalidError();
  }
  if (
    row.used ||
    row.attemptCount >= OTP_MAX_VERIFY_ATTEMPTS ||
    row.expiresAt.getTime() < Date.now()
  ) {
    throw new OtpExpiredError();
  }

  const devBypass = isDevStaticOtpEnabled() && trimmedCode === DEV_STATIC_OTP;
  const hashValid = await verifyOtpCodeHash(trimmedCode, row.codeHash);
  if (!devBypass && !hashValid) {
    await repo.recordOtpChallengeFailure(challengeId, OTP_MAX_VERIFY_ATTEMPTS);
    throw new OtpInvalidError();
  }

  if (!(await repo.markOtpChallengeUsed(challengeId))) throw new OtpExpiredError();
  return { mobile: row.mobile };
}

/**
 * Verify without consuming: the caller must consume this exact challenge and
 * update the credential in one transaction, checking its scope and code hash
 * again. This proof is internal and must never be returned to a browser.
 */
export async function verifyPasswordChangeOtp(
  challengeId: string,
  code: string,
  scope: { readonly tenantId: string; readonly userId: string; readonly mobile: string },
  repo: IdentityRepository = getIdentityRepository()
): Promise<{ readonly challengeId: string; readonly codeHash: string }> {
  const row = await repo.findOtpChallenge(challengeId);
  if (
    row === null ||
    row.purpose !== "password_change" ||
    row.tenantId !== scope.tenantId ||
    row.userId !== scope.userId ||
    row.mobile !== canonicalizeLoginMobile(scope.mobile)
  ) {
    throw new OtpChallengeInvalidError();
  }
  if (
    row.used ||
    row.attemptCount >= OTP_MAX_VERIFY_ATTEMPTS ||
    row.expiresAt.getTime() <= Date.now()
  ) {
    throw new OtpExpiredError();
  }
  const trimmedCode = typeof code === "string" ? code.trim() : "";
  const hashValid = await verifyOtpCodeHash(trimmedCode, row.codeHash);
  const devBypass = isDevStaticOtpEnabled() && trimmedCode === DEV_STATIC_OTP;
  if (!devBypass && !hashValid) {
    await repo.recordOtpChallengeFailure(challengeId, OTP_MAX_VERIFY_ATTEMPTS);
    throw new OtpInvalidError();
  }
  return { challengeId: row.id, codeHash: row.codeHash };
}
