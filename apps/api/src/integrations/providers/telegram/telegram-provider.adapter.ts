import { assertSafeOutboundUrl } from "../../egress/assert-safe-outbound-url";
import type { IntegrationCapability } from "../../platform/integration-capability";
import type {
  IntegrationCreateChannelLinkInput,
  IntegrationDeliveryContext,
  IntegrationDeliveryResult,
  IntegrationProviderAdapter,
  IntegrationSendMessageInput,
} from "../../platform/integration-provider.types";
import { TELEGRAM_API_HOST } from "./telegram.types";

const TELEGRAM_CAPABILITIES = [
  "message.send",
  "channel.create",
] as const satisfies readonly IntegrationCapability[];

function readBotToken(ctx: IntegrationDeliveryContext): string | null {
  const token = ctx.credentials.botToken;
  return typeof token === "string" && token.trim().length > 0 ? token.trim() : null;
}

function telegramApiUrl(botToken: string, method: string): URL {
  return assertSafeOutboundUrl({
    url: `https://${TELEGRAM_API_HOST}/bot${botToken}/${method}`,
    allowedHosts: [TELEGRAM_API_HOST],
  });
}

/** Telegram provider plugin — HTTP mapping only. */
export class TelegramProviderAdapter implements IntegrationProviderAdapter {
  readonly id = "telegram" as const;
  readonly supportedCapabilities = TELEGRAM_CAPABILITIES;

  async sendMessage(
    ctx: IntegrationDeliveryContext,
    input: IntegrationSendMessageInput
  ): Promise<IntegrationDeliveryResult> {
    const botToken = readBotToken(ctx);
    if (botToken === null) {
      return { ok: false, errorCode: "TELEGRAM_BOT_TOKEN_MISSING" };
    }

    const url = telegramApiUrl(botToken, "sendMessage");
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: input.channelId,
        text: input.text,
        ...(input.parseMode !== undefined ? { parse_mode: input.parseMode } : {}),
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        errorCode: "TELEGRAM_SEND_FAILED",
        errorMessage: `HTTP ${response.status}`,
      };
    }

    const body = (await response.json()) as { ok?: boolean; result?: { message_id?: number } };
    if (body.ok !== true) {
      return { ok: false, errorCode: "TELEGRAM_API_ERROR" };
    }

    return {
      ok: true,
      providerMessageId:
        body.result?.message_id !== undefined ? String(body.result.message_id) : undefined,
    };
  }

  async createChannelLink(
    ctx: IntegrationDeliveryContext,
    input: IntegrationCreateChannelLinkInput
  ): Promise<IntegrationDeliveryResult> {
    const botToken = readBotToken(ctx);
    if (botToken === null) {
      return { ok: false, errorCode: "TELEGRAM_BOT_TOKEN_MISSING" };
    }

    void input;
    void botToken;
    return { ok: true, inviteLink: undefined };
  }
}

export function createTelegramProviderAdapter(): TelegramProviderAdapter {
  return new TelegramProviderAdapter();
}
