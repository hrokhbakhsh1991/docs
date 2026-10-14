import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TelegramApiError } from "../providers/telegram/telegram-api.client";
import {
  assertTelegramActionTopic,
  assertTelegramTopicProvisionRetrySafe,
  isTelegramOperatorStatus,
  mergeTelegramPatchConfig,
  probeTelegramTopicMappings,
  resolveIntegrationEnableReadinessError,
  resolveTelegramProvisionConnectionState,
} from "./integrations.service";

describe("Telegram integration rebind config", () => {
  it("clears old forum topics when the Chat ID changes", () => {
    const result = mergeTelegramPatchConfig(
      {
        chatId: "-100111",
        channelId: "-100111",
        groupName: "Old Forum",
        topicThreadIds: { registration: 10, receipts: 11 },
        topicNames: { registration: "ثبت‌نام", receipts: "فیش‌ها" },
      },
      { channelId: "-100222", groupName: "New Forum" }
    );

    assert.equal(result.chatChanged, true);
    assert.equal(result.groupChanged, true);
    assert.equal(result.config.chatId, "-100222");
    assert.equal(result.config.channelId, "-100222");
    assert.equal(result.config.groupName, "New Forum");
    assert.deepEqual(result.config.topicThreadIds, {});
    assert.deepEqual(result.config.topicNames, {});
  });

  it("keeps topic mappings when only the forum title changes", () => {
    const topics = { registration: 10, receipts: 11 };
    const names = { registration: "ثبت‌نام", receipts: "فیش‌ها" };
    const result = mergeTelegramPatchConfig(
      {
        chatId: "-100111",
        groupName: "Old Forum",
        topicThreadIds: topics,
        topicNames: names,
      },
      { groupName: "Renamed Forum" }
    );

    assert.equal(result.chatChanged, false);
    assert.equal(result.groupChanged, true);
    assert.deepEqual(result.config.topicThreadIds, topics);
    assert.deepEqual(result.config.topicNames, names);
  });

  it("does not treat an unchanged binding as a rebind", () => {
    const result = mergeTelegramPatchConfig(
      { chatId: "-100111", groupName: "Forum" },
      { channelId: "-100111", groupName: " Forum " }
    );

    assert.equal(result.chatChanged, false);
    assert.equal(result.groupChanged, false);
    assert.equal(result.config.chatId, "-100111");
    assert.equal(result.config.groupName, "Forum");
  });
});

describe("Telegram topic repair probe", () => {
  const topicThreadIds = { registration: 10, receipts: 11, tickets: 12, tours: 13 };

  it("keeps every healthy topic checkpoint", async () => {
    const probed: number[] = [];
    const result = await probeTelegramTopicMappings({
      chatId: "-100111",
      topicThreadIds,
      api: {
        sendChatAction: async (input) => {
          probed.push(input.messageThreadId ?? 0);
        },
      },
    });

    assert.deepEqual(result, topicThreadIds);
    assert.deepEqual(probed, [10, 11, 12, 13]);
  });

  it("removes only a topic Telegram definitively reports as deleted", async () => {
    const result = await probeTelegramTopicMappings({
      chatId: "-100111",
      topicThreadIds,
      api: {
        sendChatAction: async (input) => {
          if (input.messageThreadId === 11) {
            throw new TelegramApiError(
              "sendChatAction",
              400,
              "Bad Request: message thread not found"
            );
          }
        },
      },
    });

    assert.deepEqual(result, { registration: 10, tickets: 12, tours: 13 });
  });

  it("does not erase mappings on a network or permission failure", async () => {
    await assert.rejects(
      probeTelegramTopicMappings({
        chatId: "-100111",
        topicThreadIds,
        api: {
          sendChatAction: async () => {
            throw new TelegramApiError("sendChatAction", 403, "Forbidden");
          },
        },
      }),
      /INTEGRATION_TELEGRAM_API_REQUEST_FAILED/
    );
  });
});

describe("Telegram provisioning connection state", () => {
  it("keeps an active connection active after idempotent provisioning", () => {
    assert.deepEqual(resolveTelegramProvisionConnectionState({ enabled: true }), {
      enabled: true,
      status: "enabled",
    });
  });

  it("keeps a disabled connection disabled while clearing stale error state", () => {
    assert.deepEqual(resolveTelegramProvisionConnectionState({ enabled: false }), {
      enabled: false,
      status: "disabled",
    });
  });
});

describe("Telegram ambiguous topic recovery", () => {
  it("does not allow a generic repair to clear an unknown remote create outcome", () => {
    assert.throws(
      () =>
        assertTelegramTopicProvisionRetrySafe({
          telegramTopicProvisions: {
            tours: { outcome: "ambiguous", startedAt: "2026-10-11T17:00:00.000Z" },
          },
        }),
      /INTEGRATION_TELEGRAM_TOPIC_CREATE_OUTCOME_UNKNOWN/
    );
  });

  it("allows repair when no remote create is in an unknown state", () => {
    assert.doesNotThrow(() =>
      assertTelegramTopicProvisionRetrySafe({ topicThreadIds: { tours: 22 } })
    );
  });
});

describe("Telegram integration enable readiness", () => {
  const readyConfig = {
    chatId: "-100111",
    groupName: "Forum",
    topicThreadIds: { registration: 10, receipts: 11, tickets: 12, tours: 13 },
  };

  it("accepts a fully provisioned native Telegram connection", () => {
    assert.equal(
      resolveIntegrationEnableReadinessError({
        provider: "telegram",
        config: readyConfig,
        secretRef: "integration-secret:telegram-1",
      }),
      null
    );
  });

  it("rejects enablement while any required forum topic is missing", () => {
    assert.equal(
      resolveIntegrationEnableReadinessError({
        provider: "telegram",
        config: {
          ...readyConfig,
          topicThreadIds: { registration: 10, receipts: 11, tickets: 12 },
        },
        secretRef: "integration-secret:telegram-1",
      }),
      "INTEGRATION_TELEGRAM_TOPICS_NOT_READY"
    );
  });

  it("rejects enablement while a topic create outcome is ambiguous", () => {
    assert.equal(
      resolveIntegrationEnableReadinessError({
        provider: "telegram",
        config: {
          ...readyConfig,
          telegramTopicProvisions: { tours: { outcome: "ambiguous" } },
        },
        secretRef: "integration-secret:telegram-1",
      }),
      "INTEGRATION_TELEGRAM_TOPIC_CREATE_OUTCOME_UNKNOWN"
    );
  });

  it("does not impose Telegram readiness on another provider", () => {
    assert.equal(
      resolveIntegrationEnableReadinessError({
        provider: "melipayamak",
        config: {},
        secretRef: null,
      }),
      null
    );
  });
});

describe("Telegram callback topic boundary", () => {
  const config = {
    chatId: "-100111",
    topicThreadIds: { registration: 10, receipts: 11, tickets: 12, tours: 13 },
  };

  it("accepts an action only in its configured topic", () => {
    assert.doesNotThrow(() =>
      assertTelegramActionTopic({
        config,
        chatId: "-100111",
        messageThreadId: 11,
        topicKey: "receipts",
        errorCode: "INTEGRATION_TELEGRAM_RECEIPT_TOPIC_REQUIRED",
      })
    );
  });

  it("rejects an action copied to another topic in the same group", () => {
    assert.throws(
      () =>
        assertTelegramActionTopic({
          config,
          chatId: "-100111",
          messageThreadId: 10,
          topicKey: "receipts",
          errorCode: "INTEGRATION_TELEGRAM_RECEIPT_TOPIC_REQUIRED",
        }),
      /INTEGRATION_TELEGRAM_RECEIPT_TOPIC_REQUIRED/
    );
  });

  it("rejects an action from another group even when the thread number matches", () => {
    assert.throws(
      () =>
        assertTelegramActionTopic({
          config,
          chatId: "-100222",
          messageThreadId: 11,
          topicKey: "receipts",
          errorCode: "INTEGRATION_TELEGRAM_RECEIPT_TOPIC_REQUIRED",
        }),
      /INTEGRATION_TELEGRAM_RECEIPT_TOPIC_REQUIRED/
    );
  });

  it("allows receipt and registration decisions only for Telegram operators", () => {
    assert.equal(isTelegramOperatorStatus("creator"), true);
    assert.equal(isTelegramOperatorStatus("administrator"), true);
    assert.equal(isTelegramOperatorStatus("member"), false);
    assert.equal(isTelegramOperatorStatus("restricted"), false);
  });
});
