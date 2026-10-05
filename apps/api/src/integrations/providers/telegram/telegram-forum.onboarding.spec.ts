import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TelegramApiClient } from "./telegram-api.client";
import { createTelegramForumConfig } from "./telegram-forum.config";
import { provisionTelegramForum, TelegramForumOnboardingError } from "./telegram-forum.onboarding";

function fakeApi(overrides: Partial<TelegramApiClient> = {}): TelegramApiClient {
  return {
    getMe: async () => ({ id: 9, is_bot: true, first_name: "Test", username: "test_bot" }),
    getChat: async () => ({ id: -1001, type: "supergroup", title: "denaliadmins", is_forum: true }),
    getChatMember: async () => ({ status: "administrator", can_manage_topics: true }),
    createForumTopic: async (_chatId, name) => ({ message_thread_id: name.length, name }),
    setWebhook: async () => undefined,
    ...overrides,
  };
}

describe("Telegram forum onboarding", () => {
  it("validates and creates missing topics for any Workspace", async () => {
    const result = await provisionTelegramForum({
      api: fakeApi(),
      chatId: "-1001",
      config: createTelegramForumConfig({ groupName: "denaliadmins" }),
    });

    assert.equal(result.config.chatId, "-1001");
    assert.equal(result.config.topics.registration.threadId, "ثبت‌نام‌های جدید".length);
    assert.equal(result.bot.id, 9);
  });

  it("does not recreate topics already persisted", async () => {
    let creates = 0;
    const result = await provisionTelegramForum({
      api: fakeApi({
        createForumTopic: async (_chatId, name) => {
          creates += 1;
          return { message_thread_id: 90 + creates, name };
        },
      }),
      chatId: "-1001",
      config: createTelegramForumConfig({
        groupName: "denaliadmins",
        topics: { registration: { name: "ثبت‌نام", threadId: 11 } },
      }),
    });

    assert.equal(creates, 3);
    assert.equal(result.config.topics.registration.threadId, 11);
  });

  it("persists the mapping inside the provisioning lock", async () => {
    let creates = 0;
    let persisted = createTelegramForumConfig({ groupName: "denaliadmins" });
    const config = () =>
      provisionTelegramForum({
        api: fakeApi({
          createForumTopic: async (_chatId, name) => {
            creates += 1;
            await new Promise((resolve) => setTimeout(resolve, 1));
            return { message_thread_id: 100 + creates, name };
          },
        }),
        chatId: "-1001",
        config: persisted,
        loadConfig: async () => persisted,
        saveConfig: async (next) => {
          persisted = next;
        },
      });

    await Promise.all([config(), config()]);

    assert.equal(creates, 4);
    assert.equal(persisted.topics.registration.threadId, 101);
    assert.equal(persisted.topics.receipts.threadId, 102);
    assert.equal(persisted.topics.tickets.threadId, 103);
    assert.equal(persisted.topics.tours.threadId, 104);
  });

  it("checkpoints each newly created topic before continuing", async () => {
    const checkpoints: string[] = [];
    await provisionTelegramForum({
      api: fakeApi(),
      chatId: "-1001",
      config: createTelegramForumConfig({ groupName: "denaliadmins" }),
      onTopicCreated: async (key, topic) => {
        checkpoints.push(`${key}:${topic.threadId}`);
      },
    });

    assert.deepEqual(checkpoints, [
      `registration:${"ثبت‌نام‌های جدید".length}`,
      `receipts:${"بررسی فیش‌ها".length}`,
      `tickets:${"تیکت‌ها".length}`,
      `tours:${"تورهای جدید".length}`,
    ]);
  });

  it("fails closed when the bot lacks topic-management permission", async () => {
    await assert.rejects(
      provisionTelegramForum({
        api: fakeApi({ getChatMember: async () => ({ status: "administrator" }) }),
        chatId: "-1001",
        config: createTelegramForumConfig({ groupName: "denaliadmins" }),
      }),
      (error: unknown) =>
        error instanceof TelegramForumOnboardingError &&
        error.code === "INTEGRATION_TELEGRAM_BOT_MANAGE_TOPICS_REQUIRED"
    );
  });
});
