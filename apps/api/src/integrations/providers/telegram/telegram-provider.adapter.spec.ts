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

  it("uploads receipt bytes as multipart media without a public storage URL", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; body: BodyInit | null | undefined }> = [];
    globalThis.fetch = (async (url, init) => {
      calls.push({
        url: String(url),
        body: init?.body,
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
          media: {
            kind: "document",
            body: new Uint8Array([1, 2, 3]),
            contentType: "application/pdf",
            fileName: "proof.pdf",
          },
          replyMarkup: {
            inline_keyboard: [[{ text: "تأیید", callback_data: "receipt:approve:r2" }]],
          },
        }
      );

      assert.deepEqual(result, { ok: true, providerMessageId: "13" });
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.url, "https://api.telegram.org/bottest-token/sendDocument");
      assert.ok(calls[0]?.body instanceof FormData);
      const form = calls[0]?.body as FormData;
      assert.equal(form.get("chat_id"), "-1001");
      assert.equal(form.get("message_thread_id"), "8");
      assert.equal(form.get("caption"), "فیش جدید\nمبلغ قابل پرداخت: 2500000 IRR");
      assert.deepEqual(JSON.parse(String(form.get("reply_markup"))), {
        inline_keyboard: [[{ text: "تأیید", callback_data: "receipt:approve:r2" }]],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("maps Telegram's stale-thread error to a distinct errorCode for auto-recreate handling", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ ok: false, description: "Bad Request: message thread not found" }),
        { status: 400 }
      )) as typeof fetch;

    try {
      const result = await new TelegramProviderAdapter().sendMessage(
        {
          tenantId: "tenant-1",
          workspaceType: "denali",
          domainEventId: "TourPublished:1",
          eventType: "TourPublished",
          config: {},
          credentials: { botToken: "test-token" },
        },
        { channelId: "-1001", messageThreadId: 99, text: "تور جدید منتشر شد" }
      );

      assert.equal(result.ok, false);
      assert.equal(!result.ok ? result.errorCode : undefined, "TELEGRAM_TOPIC_THREAD_NOT_FOUND");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps other Telegram HTTP failures on the generic errorCode", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: false, description: "Bad Request: chat not found" }), {
        status: 400,
      })) as typeof fetch;

    try {
      const result = await new TelegramProviderAdapter().sendMessage(
        {
          tenantId: "tenant-1",
          workspaceType: "denali",
          domainEventId: "TourPublished:2",
          eventType: "TourPublished",
          config: {},
          credentials: { botToken: "test-token" },
        },
        { channelId: "-1001", text: "تور جدید منتشر شد" }
      );

      assert.equal(result.ok, false);
      assert.equal(!result.ok ? result.errorCode : undefined, "TELEGRAM_SEND_FAILED");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
