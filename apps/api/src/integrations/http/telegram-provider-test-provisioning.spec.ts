import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TelegramApiClient } from "../providers/telegram/telegram-api.client";
import {
  ensureTelegramProviderTestRegistrationTopic,
  selectTelegramTopicRecoveryJobIds,
} from "./telegram-provider-test-provisioning";

function fakeApi(overrides: Partial<TelegramApiClient> = {}): TelegramApiClient {
  return {
    getMe: async () => ({ id: 9, is_bot: true, first_name: "Test", username: "test_bot" }),
    getChat: async () => ({ id: -1001, type: "supergroup", title: "denaliAdmins", is_forum: true }),
    getChatMember: async () => ({ status: "administrator", can_manage_topics: true }),
    createForumTopic: async (_chatId, name) => ({ message_thread_id: name.length, name }),
    setWebhook: async () => undefined,
    answerCallbackQuery: async () => undefined,
    sendMessage: async () => ({ message_id: 1 }),
    ...overrides,
  };
}

describe("Telegram provider test topic provisioning", () => {
  it("creates and returns the registration forum topic when missing", async () => {
    const result = await ensureTelegramProviderTestRegistrationTopic({
      config: { chatId: "-1001", groupName: "denaliAdmins" },
      credentials: { botToken: "test-token" },
      createApiClient: () => fakeApi(),
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.threadId, "ثبت‌نام‌های جدید".length);
    assert.equal(result.provisioned, true);
    assert.deepEqual(result.config.topicThreadIds, {
      registration: "ثبت‌نام‌های جدید".length,
      receipts: "بررسی فیش‌ها".length,
      tickets: "تیکت‌ها".length,
      tours: "تورهای جدید".length,
    });
    assert.deepEqual(result.config.topicNames, {
      registration: "ثبت‌نام‌های جدید",
      receipts: "بررسی فیش‌ها",
      tickets: "تیکت‌ها",
      tours: "تورهای جدید",
    });
  });

  it("repairs missing receipts and tickets topics even when registration is already persisted", async () => {
    let getMeCalls = 0;
    const result = await ensureTelegramProviderTestRegistrationTopic({
      config: { chatId: "-1001", groupName: "denaliAdmins", topicThreadIds: { registration: 101 } },
      credentials: { botToken: "test-token" },
      createApiClient: () =>
        fakeApi({
          getMe: async () => {
            getMeCalls += 1;
            return { id: 9, is_bot: true, first_name: "Test" };
          },
        }),
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.threadId, 101);
    assert.equal(result.provisioned, true);
    assert.equal(getMeCalls, 1);
    assert.deepEqual(result.config.topicThreadIds, {
      registration: 101,
      receipts: "بررسی فیش‌ها".length,
      tickets: "تیکت‌ها".length,
      tours: "تورهای جدید".length,
    });
  });

  it("does not call Telegram when all forum topics are already persisted", async () => {
    let getMeCalls = 0;
    const config = {
      chatId: "-1001",
      groupName: "denaliAdmins",
      topicThreadIds: { registration: 101, receipts: 202, tickets: 303, tours: 404 },
    };
    const result = await ensureTelegramProviderTestRegistrationTopic({
      config,
      credentials: { botToken: "test-token" },
      createApiClient: () =>
        fakeApi({
          getMe: async () => {
            getMeCalls += 1;
            return { id: 9, is_bot: true, first_name: "Test" };
          },
        }),
    });

    assert.deepEqual(result, { ok: true, config, threadId: 101, provisioned: false });
    assert.equal(getMeCalls, 0);
  });

  it("fails closed when the bot cannot manage topics", async () => {
    const result = await ensureTelegramProviderTestRegistrationTopic({
      config: { chatId: "-1001", groupName: "denaliAdmins" },
      credentials: { botToken: "test-token" },
      createApiClient: () => fakeApi({ getChatMember: async () => ({ status: "administrator" }) }),
    });

    assert.deepEqual(result, {
      ok: false,
      code: "INTEGRATION_TELEGRAM_BOT_MANAGE_TOPICS_REQUIRED",
    });
  });

  it("selects only dead jobs recoverable by the current forum topic config", () => {
    assert.deepEqual(
      selectTelegramTopicRecoveryJobIds({
        connectionId: "connection-1",
        config: { topicThreadIds: { registration: 44, receipts: 45, tickets: 46 } },
        jobs: [
          {
            id: "registration-dead",
            payload: {
              integrationConnectionId: "connection-1",
              telegramTopicKey: "registration",
            },
            lastError: { code: "INTEGRATION_TELEGRAM_TOPIC_THREAD_ID_MISSING" },
          },
          {
            id: "other-connection",
            payload: {
              integrationConnectionId: "connection-2",
              telegramTopicKey: "registration",
            },
            lastError: { code: "INTEGRATION_TELEGRAM_TOPIC_THREAD_ID_MISSING" },
          },
          {
            id: "missing-topic",
            payload: {
              integrationConnectionId: "connection-1",
              telegramTopicKey: "unknown",
            },
            lastError: { code: "INTEGRATION_TELEGRAM_TOPIC_THREAD_ID_MISSING" },
          },
          {
            id: "different-error",
            payload: {
              integrationConnectionId: "connection-1",
              telegramTopicKey: "receipts",
            },
            lastError: { code: "TELEGRAM_NETWORK_ERROR" },
          },
        ],
      }),
      ["registration-dead"]
    );
  });
});
