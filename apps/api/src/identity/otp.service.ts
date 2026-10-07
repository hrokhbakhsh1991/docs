import {
  OtpChallengeInvalidError,
  OtpExpiredError,
  OtpInvalidError,
} from "./identity.errors";
import {
  getIdentityRepository,
  type IdentityRepository,
} from "./create-identity-repository";
import { deliverOtpCode } from "./otp-delivery";
import {
  hashOtpCode,
  resolveOtpCodeForChallenge,
  verifyOtpCodeHash,
} from "./otp-code";
import { assertOtpRequestRateLimit } from "./otp-rate-limit";
import { isStaticOtpEnabled, STAGING_STATIC_OTP_CODE } from "./static-otp-policy";
import { encryptOtpDeliveryCode } from "./otp-delivery-secret";
import {
  enqueueOtpDeliveryJob,
  resolveOtpDeliveryConnection,
} from "../integrations/application/otp-delivery-dependencies";
import type { IntegrationConnectionRecord } from "../integrations/platform/integration-connection.types";
import type { EnqueueIntegrationDeliveryJobInput } from "../integrations/platform/integration-delivery.types";

const DEV_STATIC_OTP = STAGING_STATIC_OTP_CODE;

function isDevStaticOtpEnabled(): boolean {
  return isStaticOtpEnabled();
}

export type OtpDeliveryContext = {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly purpose: "operator_login" | "member_login" | "mobile_change" | "invite";
};

export type OtpDeliveryDependencies = {
  readonly resolveConnection?: (input: {
    readonly tenantId: string;
    readonly workspaceType: string;
  }) => Promise<IntegrationConnectionRecord | null>;
  readonly enqueueJob?: (input: EnqueueIntegrationDeliveryJobInput) => Promise<boolean>;
};

async function enqueueRealOtpDelivery(
  mobile: string,
  code: string,
  challengeId: string,
  context: OtpDeliveryContext,
  dependencies: OtpDeliveryDependencies = {}
): Promise<void> {
  if (process.env.SMS_OTP_ENABLED?.trim() !== "true") {
    deliverOtpCode(mobile, code);
    return;
  }
  const connection = await (dependencies.resolveConnection ?? resolveOtpDeliveryConnection)(context);
  if (connection === null) throw new Error("MELIPAYAMAK_CONNECTION_NOT_CONFIGURED");
  const encryptedCode = encryptOtpDeliveryCode(code);
  const enqueueJob = dependencies.enqueueJob ?? enqueueOtpDeliveryJob;
  const created = await enqueueJob({
      tenantId: context.tenantId,
      provider: "melipayamak",
      capability: "sms.send",
      domainEventId: challengeId,
      eventType: "auth.otp.requested",
      payload: {
        workspaceType: context.workspaceType,
        integrationConnectionId: connection.id,
        recipient: mobile,
        smsPurpose: context.purpose,
        smsTemplateKey: "auth.otp",
        smsTemplateId: typeof connection.config.bodyId === "string" ? connection.config.bodyId : "",
        smsEncryptedVariables: encryptedCode,
      },
    });
  if (!created) return;
}

export async function createMobileOtpChallenge(
  mobile: string,
  repo: IdentityRepository = getIdentityRepository(),
  deliveryContext?: OtpDeliveryContext,
  deliveryDependencies: OtpDeliveryDependencies = {}
): Promise<{ challengeId: string }> {
  assertOtpRequestRateLimit(mobile);
  // DL-44: when static DEV OTP is enabled, issue the same code the UI hints (1234)
  // so otp-dev logs match PUBLIC_REGISTRATION_DEV_OTP / otp.devHint.
  const code = isDevStaticOtpEnabled() ? DEV_STATIC_OTP : resolveOtpCodeForChallenge();
  const codeHash = await hashOtpCode(code);
  const { challengeId } = await repo.createOtpChallenge(mobile, codeHash);
  if (deliveryContext === undefined) deliverOtpCode(mobile, code);
  else await enqueueRealOtpDelivery(mobile, code, challengeId, deliveryContext, deliveryDependencies);
  return { challengeId };
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
  if (row === null) {
    throw new OtpChallengeInvalidError();
  }
  if (row.used || row.expiresAt.getTime() < Date.now()) {
    throw new OtpExpiredError();
  }

  const devBypass = isDevStaticOtpEnabled() && trimmedCode === DEV_STATIC_OTP;
  const hashValid = await verifyOtpCodeHash(trimmedCode, row.codeHash);
  if (!devBypass && !hashValid) {
    throw new OtpInvalidError();
  }

  await repo.markOtpChallengeUsed(challengeId);
  return { mobile: row.mobile };
}
