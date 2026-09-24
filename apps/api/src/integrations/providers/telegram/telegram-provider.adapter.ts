import type { IntegrationCapability } from "../../platform/integration-capability";
import type {
  IntegrationCreateChannelLinkInput,
  IntegrationDeliveryContext,
  IntegrationDeliveryResult,
  IntegrationProviderAdapter,
  IntegrationSendMessageInput,
} from "../../platform/integration-provider.types";
import {
  buildTelegramApiMultipartRequest,
  buildTelegramApiRequest,
} from "./telegram-api.transport";

const TELEGRAM_API_TIMEOUT_MS = 15_000;

const TELEGRAM_CAPABILITIES = [
  "message.send",
  "channel.create",
] as const satisfies readonly IntegrationCapability[];

function readBotToken(ctx: IntegrationDeliveryContext): string | null {
  const token = ctx.credentials.botToken;
  return typeof token === "string" && token.trim().length > 0 ? token.trim() : null;
}

/**
 * Telegram returns a distinct, stable error description when a stored
 * message_thread_id no longer resolves to a real topic (deleted/never
 * created/stale). Callers use this specific code to trigger auto-create +
 * retry instead of treating it as a generic transient send failure.
 */
function isTelegramTopicThreadNotFoundDescription(description: string | undefined): boolean {
  if (typeof description !== "string") {
    return false;
  }
  const normalized = description.toLowerCase();
  return normalized.includes("thread not found") || normalized.includes("topic_deleted");
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

    const media = input.media;
    const method =
      media === undefined ? "sendMessage" : media.kind === "photo" ? "sendPhoto" : "sendDocument";
    const common = {
      chat_id: input.channelId,
      ...(input.messageThreadId === undefined ? {} : { message_thread_id: input.messageThreadId }),
    };
    let response: Response;
    try {
      if (media?.body !== undefined) {
        const form = new FormData();
        form.set("chat_id", input.channelId);
        if (input.messageThreadId !== undefined) {
          form.set("message_thread_id", String(input.messageThreadId));
        }
        form.set(
          media.kind,
          new Blob([media.body], { type: media.contentType ?? "application/octet-stream" }),
          media.fileName ?? "receipt"
        );
        form.set("caption", media.caption ?? input.text);
        if (input.parseMode !== undefined) form.set("parse_mode", input.parseMode);
        if (input.replyMarkup !== undefined) {
          form.set("reply_markup", JSON.stringify(input.replyMarkup));
        }
        const request = buildTelegramApiMultipartRequest(botToken, method, form);
        response = await fetch(request.url, {
          method: "POST",
          headers: request.headers,
          body: request.body,
          signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS),
        });
      } else {
        if (media !== undefined && typeof media.url !== "string") {
          return { ok: false, errorCode: "TELEGRAM_MEDIA_PAYLOAD_INVALID" };
        }
        const request = buildTelegramApiRequest(botToken, method, {
          ...common,
          ...(media === undefined
            ? {
                text: input.text,
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
      }
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
        errorCode: isTelegramTopicThreadNotFoundDescription(body.description)
          ? "TELEGRAM_TOPIC_THREAD_NOT_FOUND"
          : "TELEGRAM_SEND_FAILED",
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
