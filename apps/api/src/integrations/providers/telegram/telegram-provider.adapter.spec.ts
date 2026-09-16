import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TelegramProviderAdapter } from "./telegram-provider.adapter";

describe("Telegram provider adapter", () => {
  it("sends receipt media and topic controls through Telegram", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (url, init) => {
      calls.push({
        url: String(url),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 12 } }), {
        status: 200,
      });
    }) as typeof fetch;

    try {
      const result = await new TelegramProviderAdapter().sendMessage(
        {
          tenantId: "tenant-1",
          workspaceType: "denali",
          domainEventId: "receipt.submitted:1",
          eventType: "receipt.submitted",
          config: {},
          credentials: { botToken: "test-token" },
        },
        {
          channelId: "-1001",
          messageThreadId: 42,
          text: "فیش جدید",
          media: { kind: "document", url: "https://files.example.test/proof.pdf" },
          replyMarkup: {
            inline_keyboard: [[{ text: "تأیید", callback_data: "receipt:approve:r1" }]],
          },
        }
      );

      assert.deepEqual(result, { ok: true, providerMessageId: "12" });
      assert.equal(calls[0]?.url, "https://api.telegram.org/bottest-token/sendDocument");
      assert.deepEqual(calls[0]?.body, {
        chat_id: "-1001",
        message_thread_id: 42,
        document: "https://files.example.test/proof.pdf",
        caption: "فیش جدید",
        reply_markup: {
          inline_keyboard: [[{ text: "تأیید", callback_data: "receipt:approve:r1" }]],
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to a threaded text receipt when media URL is internal-only", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (url, init) => {
      calls.push({
        url: String(url),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 13 } }), {
        status: 200,
      });
    }) as typeof fetch;

    try {
      const result = await new TelegramProviderAdapter().sendMessage(
        {
          tenantId: "tenant-1",
          workspaceType: "denali",
          domainEventId: "receipt.submitted:2",
          eventType: "receipt.submitted",
          config: {},
          credentials: { botToken: "test-token" },
        },
        {
          channelId: "-1001",
          messageThreadId: 8,
          text: "فیش جدید\nمبلغ قابل پرداخت: 2500000 IRR",
          media: { kind: "document", url: "http://minio:9000/app-tour-dev/proof.png" },
          replyMarkup: {
            inline_keyboard: [[{ text: "تأیید", callback_data: "receipt:approve:r2" }]],
          },
        }
      );

      assert.deepEqual(result, { ok: true, providerMessageId: "13" });
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.url, "https://api.telegram.org/bottest-token/sendMessage");
      assert.match(String(calls[0]?.body.text), /لینک عمومی فایل/);
      assert.deepEqual(calls[0]?.body.reply_markup, {
        inline_keyboard: [[{ text: "تأیید", callback_data: "receipt:approve:r2" }]],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
