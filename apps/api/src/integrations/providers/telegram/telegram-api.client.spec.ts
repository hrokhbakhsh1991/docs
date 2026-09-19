import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createTelegramApiClient, TelegramApiError } from "./telegram-api.client";

describe("Telegram API client", () => {
  it("calls Telegram with the requested method and maps the result", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const client = createTelegramApiClient("test-token", async (url, init) => {
      calls.push({ url: String(url), body: String(init?.body) });
      return new Response(
        JSON.stringify({
          ok: true,
          result: { id: 7, is_bot: true, first_name: "Test", username: "test_bot" },
        }),
        { status: 200 }
      );
    });

    assert.equal((await client.getMe()).id, 7);
    assert.equal(calls[0]?.url, "https://api.telegram.org/bottest-token/getMe");
    assert.equal(calls[0]?.body, "{}");
  });

  it("creates a forum topic using Telegram's thread API", async () => {
    let body = "";
    const client = createTelegramApiClient("test-token", async (_url, init) => {
      body = String(init?.body);
      return new Response(
        JSON.stringify({
          ok: true,
          result: { message_thread_id: 42, name: "فیش‌ها" },
        }),
        { status: 200 }
      );
    });

    assert.equal((await client.createForumTopic("-1001", "فیش‌ها")).message_thread_id, 42);
    assert.deepEqual(JSON.parse(body), { chat_id: "-1001", name: "فیش‌ها" });
  });

  it("returns a safe typed error for Telegram failures", async () => {
    const client = createTelegramApiClient(
      "test-token",
      async () =>
        new Response(JSON.stringify({ ok: false, error_code: 400, description: "Bad Request" }), {
          status: 400,
        })
    );

    await assert.rejects(
      client.getMe(),
      (error: unknown) =>
        error instanceof TelegramApiError && error.method === "getMe" && error.errorCode === 400
    );
  });

  it("sends a callback answer and a threaded response", async () => {
    const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
    const client = createTelegramApiClient("test-token", async (url, init) => {
      calls.push({
        method: String(url).split("/").pop() ?? "",
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 10 } }), {
        status: 200,
      });
    });

    await client.answerCallbackQuery("callback-1", "انجام شد");
    await client.sendMessage({ chatId: "-1001", text: "پاسخ", messageThreadId: 42 });

    assert.deepEqual(calls, [
      {
        method: "answerCallbackQuery",
        body: { callback_query_id: "callback-1", text: "انجام شد" },
      },
      { method: "sendMessage", body: { chat_id: "-1001", text: "پاسخ", message_thread_id: 42 } },
    ]);
  });

  it("registers a webhook with Telegram's secret token", async () => {
    let body = "";
    const client = createTelegramApiClient("test-token", async (_url, init) => {
      body = String(init?.body);
      return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
    });

    await client.setWebhook("https://api.example/webhooks/telegram/t1/i1", "webhook-secret");

    assert.deepEqual(JSON.parse(body), {
      url: "https://api.example/webhooks/telegram/t1/i1",
      secret_token: "webhook-secret",
    });
  });

  it("uses the shared outbound relay when configured", async () => {
    const previousUrl = process.env.TELEGRAM_API_RELAY_URL;
    const previousSecret = process.env.TELEGRAM_API_RELAY_SHARED_SECRET;
    process.env.TELEGRAM_API_RELAY_URL = "https://relay.example/telegram-api";
    process.env.TELEGRAM_API_RELAY_SHARED_SECRET = "relay-secret";
    try {
      let request: { url: string; headers: Record<string, string>; body: string } | undefined;
      const client = createTelegramApiClient("test-token", async (url, init) => {
        request = {
          url: String(url),
          headers: Object.fromEntries(new Headers(init?.headers).entries()),
          body: String(init?.body),
        };
        return new Response(JSON.stringify({ ok: true, result: { id: 7 } }), { status: 200 });
      });

      await client.getMe();
      assert.equal(request?.url, "https://relay.example/telegram-api");
      assert.equal(request?.headers.authorization, "Bearer relay-secret");
      assert.deepEqual(JSON.parse(request?.body ?? "{}"), {
        token: "test-token",
        method: "getMe",
        body: {},
      });
    } finally {
      if (previousUrl === undefined) delete process.env.TELEGRAM_API_RELAY_URL;
      else process.env.TELEGRAM_API_RELAY_URL = previousUrl;
      if (previousSecret === undefined) delete process.env.TELEGRAM_API_RELAY_SHARED_SECRET;
      else process.env.TELEGRAM_API_RELAY_SHARED_SECRET = previousSecret;
    }
  });
});
