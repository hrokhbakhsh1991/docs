import { assertSafeOutboundUrl } from "../../egress/assert-safe-outbound-url";
import { TELEGRAM_API_HOST } from "./telegram.types";

const TELEGRAM_API_METHODS = new Set([
  "getMe",
  "getChat",
  "getChatMember",
  "createForumTopic",
  "setWebhook",
  "answerCallbackQuery",
  "sendMessage",
  "sendPhoto",
  "sendDocument",
]);

export type TelegramApiRequest = {
  readonly url: URL;
  readonly headers: Record<string, string>;
  readonly body: string;
};

function readRelayUrl(): URL | null {
  const raw = process.env.TELEGRAM_API_RELAY_URL?.trim() ?? "";
  if (raw.length === 0) return null;
  const url = assertSafeOutboundUrl(raw);
  if (url.protocol !== "https:") throw new Error("Telegram API relay must use HTTPS");
  return url;
}

export function buildTelegramApiRequest(
  botToken: string,
  method: string,
  body: Record<string, unknown>
): TelegramApiRequest {
  if (!TELEGRAM_API_METHODS.has(method)) {
    throw new Error("Unsupported Telegram API method");
  }

  const token = botToken.trim();
  if (token.length === 0) throw new Error("Telegram bot token is required");

  const relayUrl = readRelayUrl();
  if (relayUrl !== null) {
    const sharedSecret = process.env.TELEGRAM_API_RELAY_SHARED_SECRET?.trim() ?? "";
    if (sharedSecret.length === 0) {
      throw new Error("Telegram API relay shared secret is required");
    }
    return {
      url: relayUrl,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sharedSecret}`,
      },
      body: JSON.stringify({ token, method, body }),
    };
  }

  const url = assertSafeOutboundUrl({
    url: `https://${TELEGRAM_API_HOST}/bot${token}/${method}`,
    allowedHosts: [TELEGRAM_API_HOST],
  });
  return {
    url,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
