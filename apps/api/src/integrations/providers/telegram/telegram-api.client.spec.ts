import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  classifyTelegramApiError,
  createTelegramApiClient,
  TelegramApiError,
} from "./telegram-api.client";

const previousRelayUrl = process.env.TELEGRAM_API_RELAY_URL;
const previousRelaySecret = process.env.TELEGRAM_API_RELAY_SHARED_SECRET;

before(() => {
  process.env.TELEGRAM_API_RELAY_URL = "https://relay.example/telegram-api";
  process.env.TELEGRAM_API_RELAY_SHARED_SECRET = "relay-secret";
});

after(() => {
  if (previousRelayUrl === undefined) delete process.env.TELEGRAM_API_RELAY_URL;
  else process.env.TELEGRAM_API_RELAY_URL = previousRelayUrl;
  if (previousRelaySecret === undefined) delete process.env.TELEGRAM_API_RELAY_SHARED_SECRET;
  else process.env.TELEGRAM_API_RELAY_SHARED_SECRET = previousRelaySecret;
});

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
    assert.equal(calls[0]?.url, "https://relay.example/telegram-api");
    assert.deepEqual(JSON.parse(calls[0]?.body ?? "{}"), {
      token: "test-token",
      method: "getMe",
      body: {},
    });
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
    assert.deepEqual(JSON.parse(body).body, { chat_id: "-1001", name: "فیش‌ها" });
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

  it("retries read-only relay failures with one correlation id", async () => {
    let attempts = 0;
    const requestIds: string[] = [];
    const client = createTelegramApiClient(
      "test-token",
      async (_url, init) => {
        attempts += 1;
        requestIds.push(new Headers(init?.headers).get("x-correlation-id") ?? "");
        if (attempts < 3) {
          throw new Error("relay unavailable");
        }
        return new Response(
          JSON.stringify({
            ok: true,
            result: { id: 7, is_bot: true, first_name: "Test", username: "test_bot" },
          }),
          { status: 200 }
        );
      },
      { sleep: async () => undefined, random: () => 0, requestId: () => "req-read-1" }
    );

    assert.equal((await client.getMe()).id, 7);
    assert.equal(attempts, 3);
    assert.deepEqual(requestIds, ["req-read-1", "req-read-1", "req-read-1"]);
  });

  it("does not retry a side-effecting forum topic creation after a transport failure", async () => {
    let attempts = 0;
    const client = createTelegramApiClient(
      "test-token",
      async () => {
        attempts += 1;
        throw new Error("relay unavailable");
      },
      { sleep: async () => undefined }
    );

    await assert.rejects(client.createForumTopic("-1001", "فیش‌ها"));
    assert.equal(attempts, 1);
  });

  it("supports the read-only webhook diagnostic method", async () => {
    const client = createTelegramApiClient("test-token", async (url) => {
      assert.equal(String(url), "https://relay.example/telegram-api");
      return new Response(
        JSON.stringify({
          ok: true,
          result: { url: "https://api.example/webhook", has_custom_certificate: false, pending_update_count: 0 },
        }),
        { status: 200 }
      );
    });

    assert.equal((await client.getWebhookInfo()).pending_update_count, 0);
  });

  it("classifies token, chat, access, and network failures without exposing details", () => {
    assert.equal(
      classifyTelegramApiError(new TelegramApiError("getMe", 401, "Unauthorized")),
      "INTEGRATION_TELEGRAM_BOT_TOKEN_INVALID"
    );
    assert.equal(
      classifyTelegramApiError(new TelegramApiError("getChat", 400, "Bad Request")),
      "INTEGRATION_TELEGRAM_CHAT_INVALID"
    );
    assert.equal(
      classifyTelegramApiError(new TelegramApiError("getChatMember", 403, "Forbidden")),
      "INTEGRATION_TELEGRAM_BOT_ACCESS_INVALID"
    );
    assert.equal(
      classifyTelegramApiError(new TelegramApiError("getMe")),
      "INTEGRATION_TELEGRAM_API_UNREACHABLE"
    );
    assert.equal(
      classifyTelegramApiError(new TelegramApiError("getMe", 429, "Too Many Requests", 429)),
      "INTEGRATION_TELEGRAM_RATE_LIMITED"
    );
  });

  it("sends a callback answer, a non-persistent topic probe, and a threaded response", async () => {
    const calls: Array<{ method: string; body: Record<string, unknown> }> = [];
    const client = createTelegramApiClient("test-token", async (url, init) => {
      calls.push({
        method: (JSON.parse(String(init?.body)) as { method: string }).method,
        body: (JSON.parse(String(init?.body)) as { body: Record<string, unknown> }).body,
      });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 10 } }), {
        status: 200,
      });
    });

    await client.answerCallbackQuery("callback-1", "انجام شد");
    await client.sendChatAction?.({ chatId: "-1001", action: "typing", messageThreadId: 42 });
    await client.sendMessage({ chatId: "-1001", text: "پاسخ", messageThreadId: 42 });

    assert.deepEqual(calls, [
      {
        method: "answerCallbackQuery",
        body: { callback_query_id: "callback-1", text: "انجام شد" },
      },
      {
        method: "sendChatAction",
        body: { chat_id: "-1001", action: "typing", message_thread_id: 42 },
      },
      { method: "sendMessage", body: { chat_id: "-1001", text: "پاسخ", message_thread_id: 42 } },
    ]);
  });

  it("preserves Persian message text in the Telegram JSON body", async () => {
    let body = "";
    const client = createTelegramApiClient("test-token", async (_url, init) => {
      body = String(init?.body);
      return new Response(JSON.stringify({ ok: true, result: { message_id: 11 } }), {
        status: 200,
      });
    });

    const text =
      "ثبت‌نام جدید: Local User\nتور: صعود یک‌روزه توچال با تأیید ادمین\nوضعیت تأیید: در انتظار بررسی";
    await client.sendMessage({ chatId: "-1001", text, messageThreadId: 42 });

    assert.equal(JSON.parse(body).body.text, text);
    assert.equal(body.includes("?"), false);
    assert.equal(body.includes("�"), false);
  });

  it("registers a webhook with Telegram's secret token", async () => {
    let body = "";
    const client = createTelegramApiClient("test-token", async (_url, init) => {
      body = String(init?.body);
      return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
    });

    await client.setWebhook("https://api.example/webhooks/telegram/t1/i1", "webhook-secret");

    assert.deepEqual(JSON.parse(body).body, {
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
