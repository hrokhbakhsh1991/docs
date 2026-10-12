import assert from "node:assert/strict";
import test from "node:test";

import worker, { buildUpstreamUrl, fetchTelegramApi } from "../src/index.js";

test("builds a fixed API target without changing the webhook path", () => {
  const result = buildUpstreamUrl(
    new URL("https://relay.example/webhooks/telegram/tenant/connection?x=1"),
    "https://api.example/internal"
  );
  assert.equal(
    result.toString(),
    "https://api.example/internal/webhooks/telegram/tenant/connection?x=1"
  );
});

test("rejects non-webhook paths and methods", async () => {
  const getResponse = await worker.fetch(new Request("https://relay.example/health"), {});
  const pathResponse = await worker.fetch(
    new Request("https://relay.example/webhooks/telegram/tenant/connection", { method: "GET" }),
    { API_ORIGIN: "https://api.example" }
  );
  assert.equal(getResponse.status, 404);
  assert.equal(pathResponse.status, 404);
});

test("forwards only the webhook body and Telegram secret", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const response = await worker.fetch(
      new Request("https://relay.example/webhooks/telegram/tenant/connection", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-telegram-bot-api-secret-token": "secret-value",
        },
        body: JSON.stringify({ update_id: 1 }),
      }),
      { API_ORIGIN: "https://api.example" }
    );
    assert.equal(response.status, 200);
    assert.equal(captured.url, "https://api.example/webhooks/telegram/tenant/connection");
    assert.equal(captured.init.method, "POST");
    assert.equal(captured.init.headers.get("x-telegram-bot-api-secret-token"), "secret-value");
    assert.deepEqual(JSON.parse(new TextDecoder().decode(captured.init.body)), { update_id: 1 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fails closed when the relay origin is missing or insecure", async () => {
  const missing = await worker.fetch(
    new Request("https://relay.example/webhooks/telegram/tenant/connection", { method: "POST" }),
    {}
  );
  const insecure = await worker.fetch(
    new Request("https://relay.example/webhooks/telegram/tenant/connection", { method: "POST" }),
    { API_ORIGIN: "http://api.example" }
  );
  assert.equal(missing.status, 503);
  assert.equal(insecure.status, 503);
});

test("forwards authenticated outbound Telegram API requests without exposing token in the URL", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true, result: { id: 7 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const response = await worker.fetch(
      new Request("https://relay.example/telegram-api", {
        method: "POST",
        headers: {
          authorization: "Bearer relay-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ token: "test-token", method: "getMe", body: {} }),
      }),
      { TELEGRAM_API_RELAY_SHARED_SECRET: "relay-secret" }
      );
      assert.equal(response.status, 200);
      assert.ok(response.headers.get("x-correlation-id"));
      assert.equal(captured.url, "https://api.telegram.org/bottest-token/getMe");
    assert.equal(captured.init.headers["content-type"], "application/json");
    assert.deepEqual(JSON.parse(captured.init.body), {});
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("allows getWebhookInfo and preserves a bounded correlation id", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true, result: { url: "", pending_update_count: 0 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  try {
    const response = await worker.fetch(
      new Request("https://relay.example/telegram-api", {
        method: "POST",
        headers: {
          authorization: "Bearer relay-secret",
          "content-type": "application/json",
          "x-correlation-id": "phase1-get-webhook-info",
        },
        body: JSON.stringify({ token: "test-token", method: "getWebhookInfo", body: {} }),
      }),
      { TELEGRAM_API_RELAY_SHARED_SECRET: "relay-secret" }
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-correlation-id"), "phase1-get-webhook-info");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("maps an upstream timeout to a bounded timeout error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Promise(() => {});
  try {
    await assert.rejects(
      fetchTelegramApi("https://api.telegram.org/bottest-token/getMe", { method: "POST" }, 1),
      (error) => error?.code === "TELEGRAM_UPSTREAM_TIMEOUT"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("relay logs contain method and outcome but never token or payload", async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const logs = [];
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  console.log = (line) => logs.push(String(line));
  try {
    await worker.fetch(
      new Request("https://relay.example/telegram-api", {
        method: "POST",
        headers: {
          authorization: "Bearer relay-secret",
          "content-type": "application/json",
          "x-correlation-id": "phase1-redaction",
        },
        body: JSON.stringify({
          token: "sensitive-token",
          method: "sendMessage",
          body: { chat_id: "-1001", text: "sensitive-message" },
        }),
      }),
      { TELEGRAM_API_RELAY_SHARED_SECRET: "relay-secret" }
    );
    assert.equal(logs.length, 1);
    assert.match(logs[0], /telegram\.relay\.request/);
    assert.doesNotMatch(logs[0], /sensitive-token|sensitive-message/);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }
});

test("allows the non-persistent sendChatAction topic health probe", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const response = await worker.fetch(
      new Request("https://relay.example/telegram-api", {
        method: "POST",
        headers: {
          authorization: "Bearer relay-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          token: "test-token",
          method: "sendChatAction",
          body: { chat_id: "-1001", action: "typing", message_thread_id: 42 },
        }),
      }),
      { TELEGRAM_API_RELAY_SHARED_SECRET: "relay-secret" }
    );
    assert.equal(response.status, 200);
    assert.equal(captured.url, "https://api.telegram.org/bottest-token/sendChatAction");
    assert.deepEqual(JSON.parse(captured.init.body), {
      chat_id: "-1001",
      action: "typing",
      message_thread_id: 42,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("forwards authenticated multipart media without exposing relay fields upstream", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true, result: { message_id: 8 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const form = new FormData();
    form.set("token", "test-token");
    form.set("method", "sendPhoto");
    form.set("chat_id", "-1001");
    form.set("message_thread_id", "42");
    form.set("caption", "فیش جدید");
    form.set("photo", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), "proof.png");

    const response = await worker.fetch(
      new Request("https://relay.example/telegram-api", {
        method: "POST",
        headers: { authorization: "Bearer relay-secret" },
        body: form,
      }),
      { TELEGRAM_API_RELAY_SHARED_SECRET: "relay-secret" }
    );
    assert.equal(response.status, 200);
    assert.equal(captured.url, "https://api.telegram.org/bottest-token/sendPhoto");
    const upstreamForm = captured.init.body;
    assert.equal(upstreamForm.get("chat_id"), "-1001");
    assert.equal(upstreamForm.get("message_thread_id"), "42");
    assert.equal(upstreamForm.get("caption"), "فیش جدید");
    assert.equal(upstreamForm.get("token"), null);
    assert.equal(upstreamForm.get("method"), null);
    assert.equal(upstreamForm.get("photo").name, "proof.png");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects unauthenticated and non-allowlisted outbound requests", async () => {
  const unauthorized = await worker.fetch(
    new Request("https://relay.example/telegram-api", { method: "POST" }),
    { TELEGRAM_API_RELAY_SHARED_SECRET: "relay-secret" }
  );
  const invalidMethod = await worker.fetch(
    new Request("https://relay.example/telegram-api", {
      method: "POST",
      headers: { authorization: "Bearer relay-secret", "content-type": "application/json" },
      body: JSON.stringify({ token: "test-token", method: "deleteWebhook", body: {} }),
    }),
    { TELEGRAM_API_RELAY_SHARED_SECRET: "relay-secret" }
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(invalidMethod.status, 400);
});
