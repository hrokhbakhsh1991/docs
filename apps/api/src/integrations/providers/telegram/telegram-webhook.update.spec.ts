import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseTelegramConnectCommand,
  parseTelegramReceiptAction,
  parseTelegramTicketReply,
  parseTelegramWebhookUpdate,
} from "./telegram-webhook.update";

describe("Telegram webhook update parsing", () => {
  it("extracts a connect code and forum identity", () => {
    const result = parseTelegramConnectCommand({
      update_id: 1,
      message: {
        message_id: 2,
        text: "/connect@DenaliDenaliBot abc_1234",
        chat: { id: -10077, type: "supergroup", title: "denaliadmins", is_forum: true },
      },
    });

    assert.deepEqual(result, {
      code: "abc_1234",
      chatId: "-10077",
      groupName: "denaliadmins",
    });
  });

  it("rejects private chats and malformed commands", () => {
    assert.equal(
      parseTelegramConnectCommand({
        update_id: 1,
        message: {
          message_id: 2,
          text: "/connect abc_1234",
          chat: { id: 77, type: "private" },
        },
      }),
      null
    );
    assert.equal(
      parseTelegramConnectCommand({
        update_id: 1,
        message: {
          message_id: 2,
          text: "/connect short",
          chat: { id: -10077, type: "supergroup" },
        },
      }),
      null
    );
  });

  it("rejects malformed webhook payloads before dispatch", () => {
    assert.equal(parseTelegramWebhookUpdate({ update_id: "1" }), null);
    assert.equal(parseTelegramWebhookUpdate(null), null);
    assert.deepEqual(parseTelegramWebhookUpdate({ update_id: 5 }), { update_id: 5 });
  });

  it("extracts a ticket reply only from a native reply in a forum topic", () => {
    assert.deepEqual(
      parseTelegramTicketReply({
        update_id: 77,
        message: {
          message_id: 501,
          message_thread_id: 103,
          chat: { id: -1001, type: "supergroup", is_forum: true },
          from: { id: 42, username: "operator" },
          text: "پاسخ اپراتور",
          reply_to_message: {
            message_id: 500,
            chat: { id: -1001, type: "supergroup" },
            text: "🎫 تیکت جدید\nشناسه: TKT-000011\nموضوع: تست",
          },
        },
      }),
      {
        updateId: 77,
        messageId: 501,
        ticketCode: "TKT-000011",
        body: "پاسخ اپراتور",
        chatId: "-1001",
        userId: "42",
        messageThreadId: 103,
      }
    );
    assert.equal(
      parseTelegramTicketReply({
        update_id: 78,
        message: {
          message_id: 502,
          message_thread_id: 103,
          chat: { id: -1001, type: "supergroup" },
          from: { id: 42 },
          text: "پیام بدون Reply",
        },
      }),
      null
    );
  });

  it("extracts receipt actions only from a supergroup callback", () => {
    const result = parseTelegramReceiptAction({
      update_id: 4,
      callback_query: {
        id: "callback-1",
        data: "receipt:approve:receipt_123456",
        from: { id: 77 },
        message: { message_id: 9, chat: { id: -1001, type: "supergroup" } },
      },
    });
    assert.deepEqual(result, {
      callbackQueryId: "callback-1",
      action: "approve",
      receiptId: "receipt_123456",
      chatId: "-1001",
      userId: "77",
    });
  });

  it("rejects malformed receipt callbacks", () => {
    assert.equal(
      parseTelegramReceiptAction({
        update_id: 5,
        callback_query: {
          id: "callback-2",
          data: "receipt:delete:bad",
          from: { id: 77 },
          message: { message_id: 9, chat: { id: -1001, type: "supergroup" } },
        },
      }),
      null
    );
  });
});
