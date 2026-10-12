import { assertSafeOutboundUrl } from "../../egress/assert-safe-outbound-url";

const TELEGRAM_API_METHODS = new Set([
  "getMe",
  "getChat",
  "getChatMember",
  "getWebhookInfo",
  "createForumTopic",
  "setWebhook",
  "answerCallbackQuery",
  "sendChatAction",
  "sendMessage",
  "sendPhoto",
  "sendDocument",
]);

export type TelegramApiRequest = {
  readonly url: URL;
  readonly headers: Record<string, string>;
  readonly body: string | FormData;
};

function readRelayUrl(): URL {
  const raw = process.env.TELEGRAM_API_RELAY_URL?.trim() ?? "";
  if (raw.length === 0) throw new Error("Telegram API relay URL is required");
  const url = assertSafeOutboundUrl(raw);
  if (url.protocol !== "https:") throw new Error("Telegram API relay must use HTTPS");
  return url;
}

export function buildTelegramApiRequest(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
  requestId: string
): TelegramApiRequest {
  if (!TELEGRAM_API_METHODS.has(method)) {
    throw new Error("Unsupported Telegram API method");
  }

  const token = botToken.trim();
  if (token.length === 0) throw new Error("Telegram bot token is required");

  const relayUrl = readRelayUrl();
  const sharedSecret = process.env.TELEGRAM_API_RELAY_SHARED_SECRET?.trim() ?? "";
  if (sharedSecret.length === 0) {
    throw new Error("Telegram API relay shared secret is required");
  }
  return {
    url: relayUrl,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${sharedSecret}`,
      "x-correlation-id": requestId,
    },
    body: JSON.stringify({ token, method, body }),
  };
}

export function buildTelegramApiMultipartRequest(
  botToken: string,
  method: string,
  form: FormData,
  requestId: string
): TelegramApiRequest {
  if (!TELEGRAM_API_METHODS.has(method)) {
    throw new Error("Unsupported Telegram API method");
  }

  const token = botToken.trim();
  if (token.length === 0) throw new Error("Telegram bot token is required");

  const relayUrl = readRelayUrl();
  const sharedSecret = process.env.TELEGRAM_API_RELAY_SHARED_SECRET?.trim() ?? "";
  if (sharedSecret.length === 0) {
    throw new Error("Telegram API relay shared secret is required");
  }
  form.set("token", token);
  form.set("method", method);
  return {
    url: relayUrl,
    headers: { authorization: `Bearer ${sharedSecret}`, "x-correlation-id": requestId },
    body: form,
  };
}
