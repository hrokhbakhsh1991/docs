import { assertSafeOutboundUrl } from "../../egress/assert-safe-outbound-url";
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

function canTelegramFetchMedia(url: string): boolean {
  try {
    const parsed = assertSafeOutboundUrl(url);
    const host = parsed.hostname.trim().toLowerCase();
    return host !== "minio" && host !== "app-tour-minio" && host !== "host.docker.internal";
  } catch {
    return false;
  }
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

    const media =
      input.media !== undefined && canTelegramFetchMedia(input.media.url) ? input.media : undefined;
    const mediaUnavailable = input.media !== undefined && media === undefined;
    const method =
      media === undefined ? "sendMessage" : media.kind === "photo" ? "sendPhoto" : "sendDocument";
    const common = {
      chat_id: input.channelId,
      ...(input.messageThreadId === undefined ? {} : { message_thread_id: input.messageThreadId }),
    };
    let response: Response;
    try {
      const request = buildTelegramApiRequest(botToken, method, {
        ...common,
        ...(media === undefined
          ? {
              text: mediaUnavailable
                ? `${input.text}\nفایل فیش در سامانه ذخیره شد؛ لینک عمومی فایل برای اتصال Telegram تنظیم نشده است.`
                : input.text,
              ...(input.parseMode !== undefined ? { parse_mode: input.parseMode } : {}),
            }
          : {
              [media.kind]: media.url,
              caption: media.caption ?? input.text,
              ...(input.parseMode !== undefined ? { parse_mode: input.parseMode } : {}),
              ...(input.replyMarkup === undefined ? {} : { reply_markup: input.replyMarkup }),
            }),
        ...(media === undefined && input.replyMarkup !== undefined
          ? { reply_markup: input.replyMarkup }
          : {}),
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

    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (!response.ok) {
      return {
        ok: false,
        errorCode: "TELEGRAM_SEND_FAILED",
        errorMessage:
          typeof body.description === "string"
            ? `HTTP ${response.status}: ${body.description}`
            : `HTTP ${response.status}`,
      };
    }

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
