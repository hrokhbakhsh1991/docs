import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ensureTelegramProviderTestRegistrationTopic,
  selectTelegramTopicRecoveryJobIds,
} from "./telegram-provider-test-provisioning";
import type { TelegramApiClient } from "../providers/telegram/telegram-api.client";

function fakeForumApi(): TelegramApiClient {
  let nextThreadId = 100;
  return {
    async getMe() {
      return { id: 1, is_bot: true, first_name: "Test", username: "test_bot" };
    },
    async getChat() {
      return { id: -1001, type: "supergroup", title: "denaliAdmins", is_forum: true };
    },
    async getChatMember() {
      return { status: "administrator", can_manage_topics: true };
    },
    async createForumTopic() {
      nextThreadId += 1;
      return { message_thread_id: nextThreadId };
    },
  } as TelegramApiClient;
}

describe("Telegram provider test topic provisioning", () => {
  it("creates missing topics once and returns their persisted mapping", async () => {
    const result = await ensureTelegramProviderTestRegistrationTopic({
      config: { chatId: "-1001", groupName: "denaliAdmins" },
      credentials: { botToken: "test-token" },
      createApiClient: () => fakeForumApi(),
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.threadId, 101);
      assert.equal(result.provisioned, true);
      assert.deepEqual(result.config.topicThreadIds, {
        registration: 101,
        receipts: 102,
        tickets: 103,
        tours: 104,
      });
    }
  });

  it("reuses complete persisted mappings without creating duplicates", async () => {
    const result = await ensureTelegramProviderTestRegistrationTopic({
      config: {
        chatId: "-1001",
        groupName: "denaliAdmins",
        topicThreadIds: { registration: 101, receipts: 102, tickets: 103, tours: 104 },
      },
      credentials: { botToken: "test-token" },
      createApiClient: () => {
        throw new Error("must not create a Telegram client when mappings are complete");
      },
    });

    assert.deepEqual(result, {
      ok: true,
      config: {
        chatId: "-1001",
        groupName: "denaliAdmins",
        topicThreadIds: { registration: 101, receipts: 102, tickets: 103, tours: 104 },
      },
      threadId: 101,
      provisioned: false,
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
      createApiClient: () => {
        getMeCalls += 1;
        throw new Error("must not create a Telegram client");
      },
    });

    assert.deepEqual(result, { ok: true, config, threadId: 101, provisioned: false });
    assert.equal(getMeCalls, 0);
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
