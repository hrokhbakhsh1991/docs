import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { IntegrationDeliveryJobRecord } from "../platform/integration-delivery.types";
import {
  executeIntegrationDeliveryJob,
  processIntegrationDeliveryOnce,
} from "./process-integration-delivery-once";
import type { IntegrationDeliveryRepository } from "../infrastructure/prisma-integration-delivery.repository";
import {
  resolveIntegrationDeliveryChannelId,
  resolveTelegramDeliveryThreadId,
} from "./process-integration-delivery-once";

function deliveryJob(
  overrides: Partial<IntegrationDeliveryJobRecord> = {}
): IntegrationDeliveryJobRecord {
  return {
    id: "job-1",
    tenantId: "tenant-denali",
    provider: "telegram",
    capability: "message.send",
    domainEventId: "receipt.submitted:receipt-1",
    eventType: "receipt.submitted",
    payload: {
      workspaceType: "denali",
      integrationConnectionId: "connection-1",
      telegramTopicKey: "receipts",
      receiptId: "receipt-1",
      registrationId: "registration-1",
      paymentId: "payment-1",
      amount: "2500000",
      currency: "IRR",
      submittedAt: "2026-09-18T20:00:00.000Z",
    },
    status: "pending",
    attemptCount: 0,
    nextAttemptAt: null,
    ...overrides,
  };
}

describe("integration delivery destination resolution", () => {
  it("uses Telegram chatId when the forum connection has no generic channelId", () => {
    assert.equal(
      resolveIntegrationDeliveryChannelId({
        provider: "telegram",
        config: { chatId: " -1004292581496 " },
      }),
      "-1004292581496"
    );
  });

  it("keeps an explicit generic channelId as the source of truth", () => {
    assert.equal(
      resolveIntegrationDeliveryChannelId({
        provider: "telegram",
        config: { channelId: " @legacy ", chatId: "-1001" },
      }),
      "@legacy"
    );
  });

  it("does not use Telegram chatId as a destination for another provider", () => {
    assert.equal(
      resolveIntegrationDeliveryChannelId({
        provider: "slack",
        config: { chatId: "-1001" },
      }),
      null
    );
  });
});

describe("Telegram worker delivery", () => {
  it("sends a receipt to the persisted forum topic when the connection stores chatId", async () => {
    const sent: Array<{ channelId: string; messageThreadId?: number }> = [];
    const result = await executeIntegrationDeliveryJob(deliveryJob(), {
      resolveConnection: async () => ({
        id: "connection-1",
        tenantId: "tenant-denali",
        workspaceType: "denali",
        provider: "telegram",
        status: "enabled",
        enabled: true,
        capabilities: ["message.send"],
        config: { chatId: "-1004292581496", topicThreadIds: { receipts: 202 } },
        secretRef: "secret-1",
        credentials: { botToken: "test-token" },
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }),
      getProvider: () => ({
        id: "telegram",
        supportedCapabilities: ["message.send"],
        async sendMessage(_ctx, input) {
          sent.push({ channelId: input.channelId, messageThreadId: input.messageThreadId });
          return { ok: true };
        },
      }),
    });

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(sent, [{ channelId: "-1004292581496", messageThreadId: 202 }]);
  });

  it("does not send a mapped event when its forum topic is missing and auto-create fails", async () => {
    let sendCount = 0;
    let autoCreateAttempted = false;
    const result = await executeIntegrationDeliveryJob(deliveryJob(), {
      resolveConnection: async () => ({
        id: "connection-1",
        tenantId: "tenant-denali",
        workspaceType: "denali",
        provider: "telegram",
        status: "enabled",
        enabled: true,
        capabilities: ["message.send"],
        config: { chatId: "-1004292581496", topicThreadIds: {} },
        secretRef: "secret-1",
        credentials: { botToken: "test-token" },
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }),
      getProvider: () => ({
        id: "telegram",
        supportedCapabilities: ["message.send"],
        async sendMessage() {
          sendCount += 1;
          return { ok: true };
        },
      }),
      createTelegramTopicApi: () => ({
        async createForumTopic() {
          autoCreateAttempted = true;
          throw new Error("telegram unavailable");
        },
      }),
    });

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "INTEGRATION_TELEGRAM_TOPIC_THREAD_ID_MISSING",
        message: "No Telegram forum topic is configured for receipts",
      },
    });
    assert.equal(sendCount, 0);
    assert.equal(autoCreateAttempted, true);
  });

  it("auto-creates a missing forum topic, persists it, and delivers the message", async () => {
    const sent: Array<{ channelId: string; messageThreadId?: number }> = [];
    const persisted: Array<{ topicKey: string; topicName: string; threadId: number }> = [];
    const result = await executeIntegrationDeliveryJob(deliveryJob(), {
      resolveConnection: async () => ({
        id: "connection-1",
        tenantId: "tenant-denali",
        workspaceType: "denali",
        provider: "telegram",
        status: "enabled",
        enabled: true,
        capabilities: ["message.send"],
        config: { chatId: "-1004292581496", topicThreadIds: {} },
        secretRef: "secret-1",
        credentials: { botToken: "test-token" },
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }),
      getProvider: () => ({
        id: "telegram",
        supportedCapabilities: ["message.send"],
        async sendMessage(_ctx, input) {
          sent.push({ channelId: input.channelId, messageThreadId: input.messageThreadId });
          return { ok: true };
        },
      }),
      createTelegramTopicApi: () => ({
        async createForumTopic() {
          return { message_thread_id: 909 };
        },
      }),
      persistTelegramTopicThreadId: async (input) => {
        persisted.push({
          topicKey: input.topicKey,
          topicName: input.topicName,
          threadId: input.threadId,
        });
      },
    });

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(sent, [{ channelId: "-1004292581496", messageThreadId: 909 }]);
    assert.deepEqual(persisted, [
      { topicKey: "receipts", topicName: "بررسی فیش‌ها", threadId: 909 },
    ]);
  });

  it("recreates a stale forum topic and retries once after Telegram reports it missing", async () => {
    const sendAttempts: Array<{ messageThreadId?: number }> = [];
    const result = await executeIntegrationDeliveryJob(deliveryJob(), {
      resolveConnection: async () => ({
        id: "connection-1",
        tenantId: "tenant-denali",
        workspaceType: "denali",
        provider: "telegram",
        status: "enabled",
        enabled: true,
        capabilities: ["message.send"],
        config: { chatId: "-1004292581496", topicThreadIds: { receipts: 202 } },
        secretRef: "secret-1",
        credentials: { botToken: "test-token" },
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }),
      getProvider: () => ({
        id: "telegram",
        supportedCapabilities: ["message.send"],
        async sendMessage(_ctx, input) {
          sendAttempts.push({ messageThreadId: input.messageThreadId });
          if (input.messageThreadId === 202) {
            return { ok: false, errorCode: "TELEGRAM_TOPIC_THREAD_NOT_FOUND" };
          }
          return { ok: true };
        },
      }),
      createTelegramTopicApi: () => ({
        async createForumTopic() {
          return { message_thread_id: 303 };
        },
      }),
      persistTelegramTopicThreadId: async () => undefined,
    });

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(sendAttempts, [{ messageThreadId: 202 }, { messageThreadId: 303 }]);
  });

  it("never auto-creates topics for legacy WorkspaceTelegramBot-backed connections", async () => {
    let sendCount = 0;
    let autoCreateAttempted = false;
    const result = await executeIntegrationDeliveryJob(
      deliveryJob({
        payload: {
          workspaceType: "denali",
          integrationConnectionId: "legacy-telegram:workspace-1",
          telegramTopicKey: "receipts",
          receiptId: "receipt-1",
          registrationId: "registration-1",
          paymentId: "payment-1",
          amount: "2500000",
          currency: "IRR",
          submittedAt: "2026-09-18T20:00:00.000Z",
        },
      }),
      {
        resolveConnection: async () => ({
          id: "legacy-telegram:workspace-1",
          tenantId: "tenant-denali",
          workspaceType: "denali",
          provider: "telegram",
          status: "enabled",
          enabled: true,
          capabilities: ["message.send"],
          config: { chatId: "-1004292581496", topicThreadIds: {} },
          secretRef: "secret-1",
          credentials: { botToken: "test-token" },
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }),
        getProvider: () => ({
          id: "telegram",
          supportedCapabilities: ["message.send"],
          async sendMessage() {
            sendCount += 1;
            return { ok: true };
          },
        }),
        createTelegramTopicApi: () => ({
          async createForumTopic() {
            autoCreateAttempted = true;
            return { message_thread_id: 909 };
          },
        }),
      }
    );

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "INTEGRATION_TELEGRAM_TOPIC_THREAD_ID_MISSING",
        message: "No Telegram forum topic is configured for receipts",
      },
    });
    assert.equal(sendCount, 0);
    assert.equal(autoCreateAttempted, false);
  });

  it("sends a registration.created event only to the registration forum topic", async () => {
    const sent: Array<{ channelId: string; messageThreadId?: number }> = [];
    const result = await executeIntegrationDeliveryJob(
      deliveryJob({
        domainEventId: "registration.created:registration-1",
        eventType: "registration.created",
        payload: {
          workspaceType: "denali",
          integrationConnectionId: "connection-1",
          telegramTopicKey: "registration",
          registrationId: "registration-1",
          tourTitle: "صعود یک‌روزه توچال با تأیید ادمین",
          participantName: "ali",
          participantPhone: "09000000000",
          createdAt: "2026-09-19T11:00:00.000Z",
        },
      }),
      {
        resolveConnection: async () => ({
          id: "connection-1",
          tenantId: "tenant-denali",
          workspaceType: "denali",
          provider: "telegram",
          status: "enabled",
          enabled: true,
          capabilities: ["message.send"],
          config: { chatId: "-1004292581496", topicThreadIds: { registration: 101 } },
          secretRef: "secret-1",
          credentials: { botToken: "test-token" },
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }),
        getProvider: () => ({
          id: "telegram",
          supportedCapabilities: ["message.send"],
          async sendMessage(_ctx, input) {
            sent.push({ channelId: input.channelId, messageThreadId: input.messageThreadId });
            return { ok: true };
          },
        }),
      }
    );

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(sent, [{ channelId: "-1004292581496", messageThreadId: 101 }]);
  });
});

describe("Telegram forum delivery routing", () => {
  it("resolves the persisted thread for a mapped topic", () => {
    assert.deepEqual(
      resolveTelegramDeliveryThreadId({
        config: { topicThreadIds: { registration: 101, receipts: 202 } },
        topicKey: "receipts",
      }),
      { ok: true, threadId: 202 }
    );
  });

  it("fails closed instead of sending a mapped event to General", () => {
    assert.deepEqual(
      resolveTelegramDeliveryThreadId({
        config: { topicThreadIds: { registration: 101 } },
        topicKey: "receipts",
      }),
      { ok: false }
    );
  });

  it("allows events without a topic mapping to use the group root", () => {
    assert.deepEqual(resolveTelegramDeliveryThreadId({ config: {}, topicKey: null }), { ok: true });
  });

  it("rejects zero, fractional, and non-numeric thread IDs", () => {
    for (const threadId of [0, -1, 1.5, "42", null]) {
      assert.deepEqual(
        resolveTelegramDeliveryThreadId({
          config: { topicThreadIds: { tickets: threadId } },
          topicKey: "tickets",
        }),
        { ok: false }
      );
    }
  });
});

describe("integration delivery retry lifecycle", () => {
  function repositoryFor(job: IntegrationDeliveryJobRecord, events: string[]) {
    const repository: IntegrationDeliveryRepository = {
      async enqueueJob() {
        return false;
      },
      async claimPendingBatch() {
        events.push("claim");
        return [job];
      },
      async markDone() {
        events.push("done");
      },
      async markFailedForRetry(input) {
        events.push(`retry:${input.attemptCount}:${String(input.lastError.code)}`);
      },
      async markDead(input) {
        events.push(`dead:${String(input.lastError.code)}`);
      },
    };
    return repository;
  }

  it("marks a transient Telegram failure for retry once without a second send", async () => {
    const events: string[] = [];
    const result = await processIntegrationDeliveryOnce(
      {
        deliveryRepository: repositoryFor(deliveryJob(), events),
        reclaimStaleProcessingJobs: async () => 0,
        executeJob: async () => ({
          ok: false,
          error: { code: "TELEGRAM_429" },
        }),
      },
      1
    );

    assert.deepEqual(result, { claimed: 1, done: 0, retried: 1, dead: 0, reclaimed: 0 });
    assert.deepEqual(events, ["claim", "retry:1:TELEGRAM_429"]);
  });

  it("moves the eighth failed attempt to dead without another retry", async () => {
    const events: string[] = [];
    const result = await processIntegrationDeliveryOnce(
      {
        deliveryRepository: repositoryFor(deliveryJob({ attemptCount: 7 }), events),
        reclaimStaleProcessingJobs: async () => 0,
        executeJob: async () => ({
          ok: false,
          error: { code: "TELEGRAM_5XX" },
        }),
      },
      1
    );

    assert.deepEqual(result, { claimed: 1, done: 0, retried: 0, dead: 1, reclaimed: 0 });
    assert.deepEqual(events, ["claim", "dead:TELEGRAM_5XX"]);
  });
});
