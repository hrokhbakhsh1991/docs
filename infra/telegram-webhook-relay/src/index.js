const TELEGRAM_WEBHOOK_PATH = /^\/webhooks\/telegram\/[^/]+\/[^/]+$/;
const TELEGRAM_API_PATH = "/telegram-api";
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
const MAX_BODY_BYTES = 1_000_000;

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function buildUpstreamUrl(requestUrl, apiOrigin) {
  const origin = new URL(apiOrigin);
  if (origin.protocol !== "https:") {
    throw new Error("API_ORIGIN must use HTTPS");
  }
  const upstream = new URL(origin);
  upstream.pathname = `${origin.pathname.replace(/\/+$/, "")}${requestUrl.pathname}`;
  upstream.search = requestUrl.search;
  return upstream;
}

function buildTelegramApiUrl(token, method) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);

    if (request.method === "POST" && requestUrl.pathname === TELEGRAM_API_PATH) {
      const sharedSecret =
        typeof env.TELEGRAM_API_RELAY_SHARED_SECRET === "string"
          ? env.TELEGRAM_API_RELAY_SHARED_SECRET.trim()
          : "";
      const authorization = request.headers.get("authorization") ?? "";
      if (sharedSecret.length === 0 || authorization !== `Bearer ${sharedSecret}`) {
        return jsonResponse({ error: "unauthorized" }, 401);
      }

      const body = await request.arrayBuffer();
      if (body.byteLength > MAX_BODY_BYTES) {
        return jsonResponse({ error: "payload_too_large" }, 413);
      }

      let payload;
      try {
        payload = JSON.parse(new TextDecoder().decode(body));
      } catch {
        return jsonResponse({ error: "invalid_json" }, 400);
      }
      const token = typeof payload?.token === "string" ? payload.token.trim() : "";
      const method = typeof payload?.method === "string" ? payload.method.trim() : "";
      if (
        token.length === 0 ||
        !TELEGRAM_API_METHODS.has(method) ||
        payload?.body === null ||
        typeof payload?.body !== "object" ||
        Array.isArray(payload.body)
      ) {
        return jsonResponse({ error: "invalid_telegram_request" }, 400);
      }

      try {
        const upstream = await fetch(buildTelegramApiUrl(token, method), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload.body),
        });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "content-type": upstream.headers.get("content-type") ?? "application/json",
          },
        });
      } catch {
        return jsonResponse({ error: "telegram_unavailable" }, 502);
      }
    }

    if (request.method !== "POST" || !TELEGRAM_WEBHOOK_PATH.test(requestUrl.pathname)) {
      return jsonResponse({ error: "not_found" }, 404);
    }

    const apiOrigin = typeof env.API_ORIGIN === "string" ? env.API_ORIGIN.trim() : "";
    if (apiOrigin.length === 0) {
      return jsonResponse({ error: "relay_not_configured" }, 503);
    }

    let upstreamUrl;
    try {
      upstreamUrl = buildUpstreamUrl(requestUrl, apiOrigin);
    } catch {
      return jsonResponse({ error: "relay_not_configured" }, 503);
    }

    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "payload_too_large" }, 413);
    }

    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    const secret = request.headers.get("x-telegram-bot-api-secret-token");
    if (contentType !== null) headers.set("content-type", contentType);
    if (secret !== null) headers.set("x-telegram-bot-api-secret-token", secret);

    try {
      const upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers,
        body,
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "content-type": upstream.headers.get("content-type") ?? "application/json",
        },
      });
    } catch {
      return jsonResponse({ error: "upstream_unavailable" }, 502);
    }
  },
};
