import type { IntegrationCapability } from "../../platform/integration-capability";
import type {
  IntegrationCreateChannelLinkInput,
  IntegrationDeliveryContext,
  IntegrationDeliveryResult,
  IntegrationProviderAdapter,
  IntegrationSendMessageInput,
} from "../../platform/integration-provider.types";
import { buildTelegramApiRequest } from "./telegram-api.transport";

const TELEGRAM_API_TIMEOUT_MS = 15_000;

const TELEGRAM_CAPABILITIES = [
  "message.send",
  "channel.create",
] as const satisfies readonly IntegrationCapability[];

function readBotToken(ctx: IntegrationDeliveryContext): string | null {
  const token = ctx.credentials.botToken;
  return typeof token === "string" && token.trim().length > 0 ? token.trim() : null;
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

    let response: Response;
    try {
      const request = buildTelegramApiRequest(botToken, "sendMessage", {
        chat_id: input.channelId,
        text: input.text,
        ...(input.parseMode !== undefined ? { parse_mode: input.parseMode } : {}),
      });
      response = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: request.body,
        signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS),
      });
    } catch {
      return { ok: false, errorCode: "TELEGRAM_NETWORK_ERROR" };
    }

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
