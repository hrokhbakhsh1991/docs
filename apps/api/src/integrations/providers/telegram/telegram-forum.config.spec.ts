import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createTelegramForumConfig,
  DEFAULT_TELEGRAM_FORUM_TOPIC_NAMES,
  resolveTelegramForumThreadId,
} from "./telegram-forum.config";

describe("telegram forum configuration", () => {
  it("normalizes a workspace-independent forum config with defaults", () => {
    const config = createTelegramForumConfig({ groupName: "  denaliadmins  " });

    assert.equal(config.groupName, "denaliadmins");
    assert.equal(config.chatId, undefined);
    assert.deepEqual(config.topics.registration, {
      name: DEFAULT_TELEGRAM_FORUM_TOPIC_NAMES.registration,
    });
  });

  it("keeps the verified chat and per-topic thread ids", () => {
    const config = createTelegramForumConfig({
      groupName: "denaliadmins",
      chatId: "-100123",
      topics: {
        receipts: { name: "فیش", threadId: 42 },
      },
    });

    assert.equal(config.chatId, "-100123");
    assert.equal(resolveTelegramForumThreadId(config, "receipts"), 42);
    assert.equal(resolveTelegramForumThreadId(config, "tickets"), undefined);
  });

  it("requires the group name before onboarding", () => {
    assert.throws(
      () => createTelegramForumConfig({ groupName: " " }),
      (error: unknown) =>
        error instanceof Error && error.message === "INTEGRATION_TELEGRAM_GROUP_NAME_REQUIRED"
    );
  });
});
