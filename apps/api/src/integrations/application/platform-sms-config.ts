import { isOtpDeliveryEncryptionKeyConfigured } from "../../identity/otp-delivery-secret";

/** Server-only credentials. Never persist this object or include it in an API response. */
export function readPlatformSmsConfig(
  env: NodeJS.ProcessEnv = process.env,
  scope: "tenant" | "platform" = "tenant"
): {
  config: { bodyId: string };
  credentials: { username: string; password: string };
  workspaceScope: string;
} {
  const username = env.MELIPAYAMAK_USERNAME?.trim();
  const apiKey = env.MELIPAYAMAK_API_KEY?.trim();
  const bodyId = (
    scope === "platform" ? env.SMS_PLATFORM_OTP_TEMPLATE_ID : env.SMS_OTP_TEMPLATE_ID
  )?.trim();
  const workspaceScope = (
    scope === "platform" ? env.SMS_PLATFORM_OTP_TEMPLATE_SCOPE : env.SMS_OTP_TEMPLATE_SCOPE
  )?.trim();
  if (!username || !apiKey || !bodyId || !/^\d+$/.test(bodyId) || !workspaceScope) {
    throw new Error("PLATFORM_SMS_CONFIG_INVALID");
  }
  if (!isOtpDeliveryEncryptionKeyConfigured(env)) {
    throw new Error("PLATFORM_SMS_ENCRYPTION_KEY_INVALID");
  }
  if (scope === "platform" && workspaceScope !== "platform")
    throw new Error("PLATFORM_SMS_CONFIG_INVALID");
  return { config: { bodyId }, credentials: { username, password: apiKey }, workspaceScope };
}
