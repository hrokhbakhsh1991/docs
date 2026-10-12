const TELEGRAM_WEBHOOK_PATH = /^\/webhooks\/telegram\/[^/]+\/[^/]+$/;
const TELEGRAM_API_PATH = "/telegram-api";
const TELEGRAM_UPSTREAM_TIMEOUT_MS = 25_000;
const TELEGRAM_READ_ONLY_TIMEOUT_MS = 8_000;
const TELEGRAM_READ_ONLY_ATTEMPTS = 3;
const TELEGRAM_READ_ONLY_METHODS = new Set([
  "getMe",
  "getChat",
  "getChatMember",
  "getWebhookInfo",
]);
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
// Receipt uploads are capped at 8 MiB in the API; leave room for multipart
// boundaries and fields while keeping the relay bounded.
const MAX_BODY_BYTES = 10_000_000;

function jsonResponse(body, status, requestId) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(requestId === undefined ? {} : { "x-correlation-id": requestId }),
    },
  });
}

function readCorrelationId(request) {
  const value = request.headers.get("x-correlation-id")?.trim() ?? "";
  return value.length > 0 ? value.slice(0, 128) : crypto.randomUUID();
}

function logRelayEvent(input) {
  console.log(
    JSON.stringify({
      event: "telegram.relay.request",
      requestId: input.requestId,
      method: input.method,
      outcome: input.outcome,
      status: input.status,
      durationMs: input.durationMs,
      timeout: input.timeout,
    })
  );
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

export async function fetchTelegramApi(url, init, timeoutMs = TELEGRAM_UPSTREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      const error = new Error("telegram upstream timeout");
      error.code = "TELEGRAM_UPSTREAM_TIMEOUT";
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([fetch(url, { ...init, signal: controller.signal }), timeoutPromise]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function forwardTelegramApi({ requestId, method, token, init }) {
  const readOnly = TELEGRAM_READ_ONLY_METHODS.has(method);
  const attempts = readOnly ? TELEGRAM_READ_ONLY_ATTEMPTS : 1;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await fetchTelegramApi(
        buildTelegramApiUrl(token, method),
        init,
        readOnly ? TELEGRAM_READ_ONLY_TIMEOUT_MS : TELEGRAM_UPSTREAM_TIMEOUT_MS
      );
      logRelayEvent({
        requestId,
        method,
        outcome: response.ok ? "success" : "telegram_error",
        status: response.status,
        durationMs: Date.now() - startedAt,
        timeout: false,
        attempt,
      });
      return response;
    } catch (error) {
      lastError = error;
      const timeout = error?.code === "TELEGRAM_UPSTREAM_TIMEOUT";
      if (attempt === attempts) {
        logRelayEvent({
          requestId,
          method,
          outcome: timeout ? "timeout" : "upstream_error",
          status: timeout ? 504 : 502,
          durationMs: Date.now() - startedAt,
          timeout,
          attempt,
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  throw lastError;
}

function proxyTelegramResponse(upstream, requestId) {
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "x-correlation-id": requestId,
    },
  });
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    const requestId = readCorrelationId(request);

    if (request.method === "POST" && requestUrl.pathname === TELEGRAM_API_PATH) {
      const sharedSecret =
        typeof env.TELEGRAM_API_RELAY_SHARED_SECRET === "string"
          ? env.TELEGRAM_API_RELAY_SHARED_SECRET.trim()
          : "";
      const authorization = request.headers.get("authorization") ?? "";
      if (sharedSecret.length === 0 || authorization !== `Bearer ${sharedSecret}`) {
        return jsonResponse({ error: "unauthorized" }, 401, requestId);
      }

      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.toLowerCase().startsWith("multipart/form-data")) {
        try {
          const declaredLength = Number(request.headers.get("content-length"));
          if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
            return jsonResponse({ error: "payload_too_large" }, 413, requestId);
          }
          const incoming = await request.formData();
          let approximateBytes = 0;
          for (const value of incoming.values()) {
            approximateBytes +=
              typeof value === "string"
                ? new TextEncoder().encode(value).byteLength
                : typeof value === "object" && value !== null && "size" in value
                  ? Number(value.size)
                  : 0;
          }
          if (approximateBytes > MAX_BODY_BYTES) {
            return jsonResponse({ error: "payload_too_large" }, 413, requestId);
          }
          const token = typeof incoming.get("token") === "string" ? incoming.get("token").trim() : "";
          const method = typeof incoming.get("method") === "string" ? incoming.get("method").trim() : "";
          if (token.length === 0 || !TELEGRAM_API_METHODS.has(method)) {
            return jsonResponse({ error: "invalid_telegram_request" }, 400, requestId);
          }
          incoming.delete("token");
          incoming.delete("method");
          const upstream = await forwardTelegramApi({ requestId, method, token, init: {
            method: "POST",
            body: incoming,
          }});
          return proxyTelegramResponse(upstream, requestId);
        } catch (error) {
          return jsonResponse(
            { error: error?.code === "TELEGRAM_UPSTREAM_TIMEOUT" ? "telegram_timeout" : "telegram_unavailable" },
            error?.code === "TELEGRAM_UPSTREAM_TIMEOUT" ? 504 : 502,
            requestId
          );
        }
      }

      const body = await request.arrayBuffer();
      if (body.byteLength > MAX_BODY_BYTES) {
        return jsonResponse({ error: "payload_too_large" }, 413, requestId);
      }

      let payload;
      try {
        payload = JSON.parse(new TextDecoder().decode(body));
      } catch {
        return jsonResponse({ error: "invalid_json" }, 400, requestId);
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
        return jsonResponse({ error: "invalid_telegram_request" }, 400, requestId);
      }

      try {
        const upstream = await forwardTelegramApi({ requestId, method, token, init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload.body),
        }});
        return proxyTelegramResponse(upstream, requestId);
      } catch (error) {
        return jsonResponse(
          { error: error?.code === "TELEGRAM_UPSTREAM_TIMEOUT" ? "telegram_timeout" : "telegram_unavailable" },
          error?.code === "TELEGRAM_UPSTREAM_TIMEOUT" ? 504 : 502,
          requestId
        );
      }
    }

    if (request.method !== "POST" || !TELEGRAM_WEBHOOK_PATH.test(requestUrl.pathname)) {
      return jsonResponse({ error: "not_found" }, 404, requestId);
    }

    const apiOrigin = typeof env.API_ORIGIN === "string" ? env.API_ORIGIN.trim() : "";
    if (apiOrigin.length === 0) {
      return jsonResponse({ error: "relay_not_configured" }, 503, requestId);
    }

    let upstreamUrl;
    try {
      upstreamUrl = buildUpstreamUrl(requestUrl, apiOrigin);
    } catch {
      return jsonResponse({ error: "relay_not_configured" }, 503, requestId);
    }

    const body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "payload_too_large" }, 413, requestId);
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
      return jsonResponse({ error: "upstream_unavailable" }, 502, requestId);
    }
  },
};
