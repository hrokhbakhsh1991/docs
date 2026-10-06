import type { IntegrationCapability } from "../../platform/integration-capability";
import type {
  IntegrationDeliveryContext,
  IntegrationDeliveryResult,
  IntegrationProviderAdapter,
  IntegrationSendMessageInput,
  IntegrationSendSmsInput,
} from "../../platform/integration-provider.types";

const MELIPAYAMAK_CAPABILITIES = ["sms.send"] as const satisfies readonly IntegrationCapability[];
const STANDARD_ENDPOINT = "https://rest.payamak-panel.com/api/SendSMS/SendSMS";
const PATTERN_ENDPOINT = "https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber";
const REQUEST_TIMEOUT_MS = 15_000;

type MelipayamakResponse = Record<string, unknown> | string | number | null;

function readString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function resolveCredential(ctx: IntegrationDeliveryContext, key: string): string | null {
  const value = ctx.credentials[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveConfig(ctx: IntegrationDeliveryContext, key: string): string | null {
  const value = ctx.config[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function classifyProviderResponse(status: number, body: MelipayamakResponse): IntegrationDeliveryResult {
  if (typeof body === "number" || typeof body === "string") {
    const value = String(body).trim();
    if (/^\d{10,}$/.test(value)) return { ok: true, providerMessageId: value };
    return {
      ok: false,
      errorCode: status >= 500 ? "MELIPAYAMAK_SERVER_ERROR" : `MELIPAYAMAK_${value || "UNKNOWN_ERROR"}`,
    };
  }

  if (body !== null) {
    const providerMessageId = readString(body, "recId", "RecId", "messageId", "MessageId", "value");
    const errorCode = readString(body, "errorCode", "ErrorCode", "code", "Code", "RetStatus");
    const errorMessage = readString(body, "errorMessage", "ErrorMessage", "message", "Message");
    const success = body.success === true || body.Success === true || providerMessageId !== undefined;
    if (success) return { ok: true, ...(providerMessageId ? { providerMessageId } : {}) };
    return {
      ok: false,
      errorCode: errorCode ? `MELIPAYAMAK_${errorCode}` : "MELIPAYAMAK_SEND_FAILED",
      ...(errorMessage ? { errorMessage } : {}),
    };
  }

  return { ok: false, errorCode: status >= 500 ? "MELIPAYAMAK_SERVER_ERROR" : "MELIPAYAMAK_EMPTY_RESPONSE" };
}

/** REST Pattern adapter for the official Melipayamak BaseServiceNumber API. */
export class MelipayamakSmsProviderAdapter implements IntegrationProviderAdapter {
  readonly id = "melipayamak" as const;
  readonly supportedCapabilities = MELIPAYAMAK_CAPABILITIES;

  async sendSms(
    ctx: IntegrationDeliveryContext,
    input: IntegrationSendSmsInput
  ): Promise<IntegrationDeliveryResult> {
    const username = resolveCredential(ctx, "username");
    const password = resolveCredential(ctx, "password");
    const bodyId = input.templateId.trim() || resolveConfig(ctx, "bodyId");
    const sender = resolveConfig(ctx, "sender");
    if (username === null || password === null) return { ok: false, errorCode: "MELIPAYAMAK_CREDENTIALS_MISSING" };
    if (bodyId === null && sender === null) {
      return { ok: false, errorCode: "MELIPAYAMAK_SENDER_MISSING" };
    }
    if (input.recipient.trim().length === 0 || input.variables.length === 0) {
      return { ok: false, errorCode: "MELIPAYAMAK_SMS_PAYLOAD_INVALID" };
    }

    const endpoint = resolveConfig(ctx, "endpoint") ?? (bodyId === null ? STANDARD_ENDPOINT : PATTERN_ENDPOINT);
    const form = new URLSearchParams({
      username,
      password,
      text: input.variables.join(","),
      to: input.recipient.trim(),
      ...(bodyId === null ? { from: sender!, isFlash: "false" } : { bodyId }),
    });

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: form,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return { ok: false, errorCode: "MELIPAYAMAK_NETWORK_ERROR" };
    }

    const raw = await response.text().catch(() => "");
    let parsed: MelipayamakResponse = raw;
    try {
      parsed = JSON.parse(raw) as MelipayamakResponse;
    } catch {
      // The REST API may return a numeric recId as plain text.
    }
    return classifyProviderResponse(response.status, parsed);
  }

  async sendMessage(
    _ctx: IntegrationDeliveryContext,
    _input: IntegrationSendMessageInput
  ): Promise<IntegrationDeliveryResult> {
    return { ok: false, errorCode: "MELIPAYAMAK_CAPABILITY_UNSUPPORTED" };
  }
}

export function createMelipayamakSmsProviderAdapter(): MelipayamakSmsProviderAdapter {
  return new MelipayamakSmsProviderAdapter();
}
