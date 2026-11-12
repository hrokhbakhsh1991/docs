import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { IntegrationDeliveryJobRecord } from "../platform/integration-delivery.types";
import { putMemberReceiptProof } from "../../workspace-finance/receipt-proof-storage";
import {
  executeIntegrationDeliveryJob,
  processIntegrationDeliveryOnce,
} from "./process-integration-delivery-once";
import type { IntegrationDeliveryRepository } from "../infrastructure/prisma-integration-delivery.repository";
import { encryptOtpDeliveryCode } from "../../identity/otp-delivery-secret";
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
  it("attaches an uploaded image when the event only carries fileKey", async () => {
    const previousStorageDriver = process.env.STORAGE_DRIVER;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.STORAGE_DRIVER = "memory";
    process.env.NODE_ENV = "test";

    try {
      const { storageKey } = await putMemberReceiptProof({
        tenantId: "tenant-denali",
        registrationId: "registration-1",
        body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        contentType: "image/jpeg",
        fileName: "payment-proof.jpg",
      });
      let capturedMedia:
        | {
            readonly kind: "photo" | "document";
            readonly body?: Uint8Array;
            readonly contentType?: string;
            readonly fileName?: string;
            readonly caption?: string;
          }
        | undefined;

      const result = await executeIntegrationDeliveryJob(
        deliveryJob({
          payload: {
            ...deliveryJob().payload,
            fileKey: storageKey,
            note: `رسید کارت به کارت\n${"جزئیات ".repeat(300)}`,
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
              capturedMedia = input.media;
              return { ok: true };
            },
          }),
        }
      );

      assert.deepEqual(result, { ok: true });
      assert.equal(capturedMedia?.kind, "photo");
      assert.equal(capturedMedia?.contentType, "image/jpeg");
      assert.match(capturedMedia?.caption ?? "", /رسید کارت به کارت/);
      assert.ok((capturedMedia?.caption ?? "").length <= 1024);
      assert.equal(capturedMedia?.fileName, "payment-proof.jpg");
      assert.deepEqual(
        [...((capturedMedia?.body ?? new Uint8Array()) as Uint8Array)],
        [0xff, 0xd8, 0xff, 0xd9]
      );
    } finally {
      if (previousStorageDriver === undefined) delete process.env.STORAGE_DRIVER;
      else process.env.STORAGE_DRIVER = previousStorageDriver;
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("sends a receipt to the persisted forum topic when the connection stores chatId", async () => {
    const sent: Array<{
      channelId: string;
      messageThreadId?: number;
      hasMedia: boolean;
    }> = [];
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
          sent.push({
            channelId: input.channelId,
            messageThreadId: input.messageThreadId,
            hasMedia: input.media !== undefined,
          });
          return { ok: true };
        },
      }),
    });

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(sent, [
      { channelId: "-1004292581496", messageThreadId: 202, hasMedia: false },
    ]);
  });

  it("attempts to create a missing forum topic and fails closed when creation is unavailable", async () => {
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
      claimTelegramTopicProvision: async (input) => ({
        status: "claimed",
        leaseToken: input.leaseToken,
      }),
      completeTelegramTopicProvision: async () => undefined,
      finishTelegramTopicProvisionFailure: async () => undefined,
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

  it("creates a missing forum topic once and sends through its persisted thread", async () => {
    let createCount = 0;
    const sentThreadIds: Array<number | undefined> = [];
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
          sentThreadIds.push(input.messageThreadId);
          return { ok: true };
        },
      }),
      createTelegramTopicApi: () => ({
        async createForumTopic() {
          createCount += 1;
          return { message_thread_id: 909 };
        },
      }),
      claimTelegramTopicProvision: async (input) => ({
        status: "claimed",
        leaseToken: input.leaseToken,
      }),
      completeTelegramTopicProvision: async () => undefined,
      finishTelegramTopicProvisionFailure: async () => undefined,
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(createCount, 1);
    assert.deepEqual(sentThreadIds, [909]);
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
      claimTelegramTopicProvision: async (input) => ({
        status: "claimed",
        leaseToken: input.leaseToken,
      }),
      completeTelegramTopicProvision: async () => undefined,
      finishTelegramTopicProvisionFailure: async () => undefined,
    });

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(sendAttempts, [{ messageThreadId: 202 }, { messageThreadId: 303 }]);
  });

  it("reuses the thread persisted by a concurrent recovery instead of creating a duplicate", async () => {
    const sendAttempts: Array<number | undefined> = [];
    let createCount = 0;
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
          sendAttempts.push(input.messageThreadId);
          return input.messageThreadId === 202
            ? { ok: false, errorCode: "TELEGRAM_TOPIC_THREAD_NOT_FOUND" }
            : { ok: true };
        },
      }),
      claimTelegramTopicProvision: async () => ({ status: "existing", threadId: 404 }),
      createTelegramTopicApi: () => ({
        async createForumTopic() {
          createCount += 1;
          return { message_thread_id: 505 };
        },
      }),
    });

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(sendAttempts, [202, 404]);
    assert.equal(createCount, 0);
  });

  it("does not send through a topic whose completion became stale after a rebind", async () => {
    const sendAttempts: Array<number | undefined> = [];
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
          sendAttempts.push(input.messageThreadId);
          return { ok: false, errorCode: "TELEGRAM_TOPIC_THREAD_NOT_FOUND" };
        },
      }),
      claimTelegramTopicProvision: async (input) => ({
        status: "claimed",
        leaseToken: input.leaseToken,
      }),
      createTelegramTopicApi: () => ({
        async createForumTopic() {
          return { message_thread_id: 505 };
        },
      }),
      completeTelegramTopicProvision: async () => "stale",
    });

    assert.deepEqual(result, {
      ok: false,
      error: {
        code: "TELEGRAM_TOPIC_THREAD_NOT_FOUND",
        message: undefined,
      },
    });
    assert.deepEqual(sendAttempts, [202]);
  });

  it("marks an unknown create outcome and does not retry the message", async () => {
    let outcomeUnknown: boolean | undefined;
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
        async sendMessage() {
          return { ok: false, errorCode: "TELEGRAM_TOPIC_THREAD_NOT_FOUND" };
        },
      }),
      claimTelegramTopicProvision: async (input) => ({
        status: "claimed",
        leaseToken: input.leaseToken,
      }),
      createTelegramTopicApi: () => ({
        async createForumTopic() {
          throw new Error("response lost after request");
        },
      }),
      completeTelegramTopicProvision: async () => undefined,
      finishTelegramTopicProvisionFailure: async (input) => {
        outcomeUnknown = input.outcomeUnknown;
      },
    });

    assert.equal(result.ok, false);
    assert.equal(outcomeUnknown, true);
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
    const sent: Array<{
      channelId: string;
      messageThreadId?: number;
      replyMarkup?: unknown;
    }> = [];
    const result = await executeIntegrationDeliveryJob(
      deliveryJob({
        domainEventId: "registration.created:registration-1",
        eventType: "registration.created",
        payload: {
          workspaceType: "denali",
          integrationConnectionId: "connection-1",
          telegramTopicKey: "registration",
          bookingId: "registration-1",
          tourTitle: "صعود یک‌روزه توچال با تأیید ادمین",
          guestLabel: "علی رضایی",
          departureAt: "2026-09-20",
          partySize: 2,
          approvalRequired: true,
          approvalPrompt: "⏳ این تور نیاز به تأیید ادمین دارد.",
          approvalStatus: "awaiting_approval",
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
            sent.push({
              channelId: input.channelId,
              messageThreadId: input.messageThreadId,
              replyMarkup: input.replyMarkup,
            });
            return { ok: true };
          },
        }),
      }
    );

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(sent, [
      {
        channelId: "-1004292581496",
        messageThreadId: 101,
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: "تأیید ثبت‌نام بدون نیاز به پرداخت",
                callback_data: "registration:apr_np:registration-1",
              },
            ],
            [
              {
                text: "تأیید ثبت‌نام؛ پرداخت لازم است",
                callback_data: "registration:apr_wp:registration-1",
              },
            ],
            [{ text: "تأیید", callback_data: "registration:apr:registration-1" }],
            [
              {
                text: "انتقال به لیست انتظار",
                callback_data: "registration:wl:registration-1",
              },
            ],
          ],
        },
      },
    ]);
  });

  it("sends a registration.waitlisted event to the registration topic without approval buttons", async () => {
    const sent: Array<{
      channelId: string;
      messageThreadId?: number;
      text?: string;
      replyMarkup?: unknown;
    }> = [];
    const result = await executeIntegrationDeliveryJob(
      deliveryJob({
        domainEventId: "registration.waitlisted:registration-2",
        eventType: "registration.waitlisted",
        payload: {
          workspaceType: "denali",
          integrationConnectionId: "connection-1",
          telegramTopicKey: "registration",
          bookingId: "registration-2",
          guestLabel: "مریم رضایی",
          tourTitle: "تور تکمیل‌ظرفیت",
          departureAt: "2026-09-20",
          partySize: 1,
          approvalPrompt: "⏳ ظرفیت تکمیل است؛ ثبت‌نام در لیست انتظار قرار گرفت.",
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
            sent.push({
              channelId: input.channelId,
              messageThreadId: input.messageThreadId,
              text: input.text,
              replyMarkup: input.replyMarkup,
            });
            return { ok: true };
          },
        }),
      }
    );

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(sent, [
      {
        channelId: "-1004292581496",
        messageThreadId: 101,
        text: "⏳ ثبت‌نام در لیست انتظار\n\n👤 نام: مریم رضایی\n🏕 تور: تور تکمیل‌ظرفیت\n📅 تاریخ حرکت: 2026-09-20\n👥 تعداد نفرات: 1\n🆔 شناسه ثبت‌نام: registration-2\n\n⏳ ظرفیت تکمیل است؛ ثبت‌نام در لیست انتظار قرار گرفت.",
        replyMarkup: undefined,
      },
    ]);
  });

  it("attaches a public PDP URL button to a manual tour announcement", async () => {
    const sent: Array<{
      messageThreadId?: number;
      text: string;
      replyMarkup?: unknown;
    }> = [];
    const result = await executeIntegrationDeliveryJob(
      deliveryJob({
        domainEventId: "TourAnnouncementRequested:tour-1:2",
        eventType: "TourAnnouncementRequested",
        payload: {
          workspaceType: "denali",
          integrationConnectionId: "connection-1",
          telegramTopicKey: "tours",
          tourId: "tour-1",
          title: "تور شمال",
          integrationDeliveryMessageTemplate:
            "🏕 عنوان تور: {{field:title}}\n⏰ زمان تقریبی بازگشت: {{field:denali.approximate-return-time}}\n🔗 اطلاعات بیشتر: {{field:denali.registration-url}}",
          integrationDeliveryFieldIds: ["title"],
          integrationDeliveryFieldValues: { title: "تور شمال" },
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
          config: { chatId: "-1004292581496", topicThreadIds: { tours: 404 } },
          secretRef: "secret-1",
          credentials: { botToken: "test-token" },
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }),
        resolveTourPublishedPdpUrl: async () => "https://denali.shenski.com/tours/tour-1",
        getProvider: () => ({
          id: "telegram",
          supportedCapabilities: ["message.send"],
          async sendMessage(_ctx, input) {
            sent.push({
              messageThreadId: input.messageThreadId,
              text: input.text,
              replyMarkup: input.replyMarkup,
            });
            return { ok: true };
          },
        }),
      }
    );

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(sent, [
      {
        messageThreadId: 404,
        text: "🏕 عنوان تور: تور شمال\n\n🔗 اطلاعات بیشتر: https://denali.shenski.com/tours/tour-1",
        replyMarkup: {
          inline_keyboard: [
            [{ text: "مشاهده تور و ثبت‌نام", url: "https://denali.shenski.com/tours/tour-1" }],
          ],
        },
      },
    ]);
  });

  it("fails closed when a TourPublished PDP URL cannot be resolved", async () => {
    let sends = 0;
    const result = await executeIntegrationDeliveryJob(
      deliveryJob({
        domainEventId: "TourPublished:tour-2:3",
        eventType: "TourPublished",
        payload: {
          workspaceType: "denali",
          integrationConnectionId: "connection-1",
          telegramTopicKey: "tours",
          tourId: "tour-2",
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
          config: { chatId: "-1004292581496", topicThreadIds: { tours: 404 } },
          secretRef: "secret-1",
          credentials: { botToken: "test-token" },
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }),
        resolveTourPublishedPdpUrl: async () => null,
        getProvider: () => ({
          id: "telegram",
          supportedCapabilities: ["message.send"],
          async sendMessage() {
            sends += 1;
            return { ok: true };
          },
        }),
      }
    );

    assert.deepEqual(result, {
      ok: false,
      error: { code: "INTEGRATION_TOUR_PDP_URL_UNAVAILABLE" },
    });
    assert.equal(sends, 0);
  });
});

describe("MeliPayamak OTP template delivery", () => {
  it("treats an unrecognized provider response as unknown without persisting provider text", async () => {
    let recorded: { status: string; errorCode?: string } | undefined;
    const result = await executeIntegrationDeliveryJob(
      deliveryJob({
        provider: "melipayamak",
        capability: "sms.send",
        eventType: "auth.otp.requested",
        payload: {
          workspaceType: "denali",
          integrationConnectionId: "sms-connection",
          recipient: "+989121234567",
          smsTemplateId: "578050",
          smsVariables: ["4826"],
        },
      }),
      {
        resolveConnection: async () => ({
          id: "sms-connection",
          tenantId: "tenant-denali",
          workspaceType: "denali",
          provider: "melipayamak",
          status: "enabled",
          enabled: true,
          capabilities: ["sms.send"],
          config: {},
          secretRef: null,
          credentials: {},
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }),
        prepareSmsUsage: async () => "ready",
        recordSmsUsage: async (input) => {
          recorded = input;
        },
        getProvider: () => ({
          id: "melipayamak",
          supportedCapabilities: ["sms.send"],
          async sendMessage() {
            return { ok: false };
          },
          async sendSms() {
            return { ok: false, errorCode: "unexpected secret", errorMessage: "secret" };
          },
        }),
      }
    );
    assert.deepEqual(result, { ok: false, error: { code: "MELIPAYAMAK_RESPONSE_INVALID" } });
    assert.equal(recorded?.status, "unknown");
    assert.equal(recorded?.errorCode, "MELIPAYAMAK_RESPONSE_INVALID");
    assert.equal(JSON.stringify(result).includes("secret"), false);
  });
  it("does not resend a previously accepted message after a job reclaim", async () => {
    let calls = 0;
    const result = await executeIntegrationDeliveryJob(
      deliveryJob({
        provider: "melipayamak",
        capability: "sms.send",
        eventType: "auth.otp.requested",
        payload: {
          workspaceType: "denali",
          integrationConnectionId: "sms-connection",
          recipient: "+989121234567",
          smsTemplateId: "578050",
          smsVariables: ["4826"],
        },
      }),
      {
        resolveConnection: async () => ({
          id: "sms-connection",
          tenantId: "tenant-denali",
          workspaceType: "denali",
          provider: "melipayamak",
          status: "enabled",
          enabled: true,
          capabilities: ["sms.send"],
          config: {},
          secretRef: null,
          credentials: {},
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }),
        prepareSmsUsage: async () => "already_sent",
        getProvider: () => ({
          id: "melipayamak",
          supportedCapabilities: ["sms.send"],
          async sendMessage() {
            return { ok: false };
          },
          async sendSms() {
            calls++;
            return { ok: true };
          },
        }),
      }
    );
    assert.deepEqual(result, { ok: true });
    assert.equal(calls, 0);
  });
  it("does not contact the provider when accounting is unavailable or an earlier outcome is uncertain", async () => {
    for (const unavailable of [true, false]) {
      let calls = 0;
      const result = await executeIntegrationDeliveryJob(
        deliveryJob({
          provider: "melipayamak",
          capability: "sms.send",
          eventType: "auth.otp.requested",
          payload: {
            workspaceType: "denali",
            integrationConnectionId: "sms-connection",
            recipient: "+989121234567",
            smsTemplateId: "578050",
            smsVariables: ["4826"],
          },
        }),
        {
          resolveConnection: async () => ({
            id: "sms-connection",
            tenantId: "tenant-denali",
            workspaceType: "denali",
            provider: "melipayamak",
            status: "enabled",
            enabled: true,
            capabilities: ["sms.send"],
            config: {},
            secretRef: null,
            credentials: {},
            createdAt: new Date(0),
            updatedAt: new Date(0),
          }),
          prepareSmsUsage: async () => {
            if (unavailable) throw new Error("db unavailable");
            return "unknown";
          },
          getProvider: () => ({
            id: "melipayamak",
            supportedCapabilities: ["sms.send"],
            async sendMessage() {
              return { ok: false };
            },
            async sendSms() {
              calls++;
              return { ok: true };
            },
          }),
        }
      );
      assert.equal(calls, 0);
      assert.equal(
        result.error?.code,
        unavailable ? "SMS_USAGE_PREPARE_FAILED" : "SMS_USAGE_OUTCOME_UNKNOWN"
      );
    }
  });
  it("delivers a central OTP with server credentials without resolving a tenant connection", async () => {
    const names = [
      "SMS_PROVIDER_MODE",
      "SMS_OTP_ENABLED",
      "SMS_DELIVERY_ENCRYPTION_KEY",
      "MELIPAYAMAK_USERNAME",
      "MELIPAYAMAK_API_KEY",
      "SMS_PLATFORM_OTP_TEMPLATE_ID",
      "SMS_PLATFORM_OTP_TEMPLATE_SCOPE",
    ] as const;
    const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    process.env.SMS_PROVIDER_MODE = "platform";
    process.env.SMS_OTP_ENABLED = "true";
    process.env.SMS_DELIVERY_ENCRYPTION_KEY = "44".repeat(32);
    process.env.MELIPAYAMAK_USERNAME = "platform-user";
    process.env.MELIPAYAMAK_API_KEY = "platform-key";
    process.env.SMS_PLATFORM_OTP_TEMPLATE_ID = "578050";
    process.env.SMS_PLATFORM_OTP_TEMPLATE_SCOPE = "platform";
    try {
      {
        let seenTenant: string | null | undefined;
        const result = await executeIntegrationDeliveryJob(
          deliveryJob({
            tenantId: null,
            deliveryScope: "platform",
            provider: "melipayamak",
            capability: "sms.send",
            eventType: "auth.otp.requested",
            payload: {
              workspaceType: "platform",
              smsDeliverySource: "platform",
              smsPurpose: "platform_ops_login",
              recipient: "+989121234567",
              smsTemplateId: "578050",
              smsEncryptedVariables: encryptOtpDeliveryCode("4826"),
            },
          }),
          {
            prepareSmsUsage: async () => "ready",
            recordSmsUsage: async () => {},
            resolveConnection: async () => {
              throw new Error("unexpected tenant connection");
            },
            getProvider: () => ({
              id: "melipayamak",
              supportedCapabilities: ["sms.send"],
              async sendMessage() {
                return { ok: false };
              },
              async sendSms(ctx, input) {
                seenTenant = ctx.tenantId;
                assert.equal(ctx.credentials.password, "platform-key");
                assert.deepEqual(input.variables, ["4826"]);
                return { ok: true, providerMessageId: "1234567890123456" };
              },
            }),
          }
        );
        assert.equal(result.ok, true);
        assert.equal(seenTenant, null);
      }
    } finally {
      for (const name of names) {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      }
    }
  });
  it("preserves tenant attribution for central-account workspace OTP jobs", async () => {
    const names = [
      "SMS_PROVIDER_MODE",
      "SMS_OTP_ENABLED",
      "SMS_DELIVERY_ENCRYPTION_KEY",
      "MELIPAYAMAK_USERNAME",
      "MELIPAYAMAK_API_KEY",
      "SMS_OTP_TEMPLATE_ID",
      "SMS_OTP_TEMPLATE_SCOPE",
    ] as const;
    const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    process.env.SMS_PROVIDER_MODE = "platform";
    process.env.SMS_OTP_ENABLED = "true";
    process.env.SMS_DELIVERY_ENCRYPTION_KEY = "44".repeat(32);
    process.env.MELIPAYAMAK_USERNAME = "platform-user";
    process.env.MELIPAYAMAK_API_KEY = "platform-key";
    process.env.SMS_OTP_TEMPLATE_ID = "578050";
    process.env.SMS_OTP_TEMPLATE_SCOPE = "denali";
    try {
      let usageTenant: string | null = null;
      let providerTenant: string | null | undefined;
      const result = await executeIntegrationDeliveryJob(
        deliveryJob({
          tenantId: "tenant-denali",
          deliveryScope: "tenant",
          provider: "melipayamak",
          capability: "sms.send",
          eventType: "auth.otp.requested",
          payload: {
            workspaceType: "denali",
            smsDeliverySource: "platform",
            smsPurpose: "member_login",
            recipient: "09224180093",
            smsTemplateId: "578050",
            smsEncryptedVariables: encryptOtpDeliveryCode("4826"),
          },
        }),
        {
          prepareSmsUsage: async (job) => {
            usageTenant = job.tenantId;
            return "ready";
          },
          recordSmsUsage: async () => {},
          resolveConnection: async () => {
            throw new Error("central account must not resolve a workspace connection");
          },
          getProvider: () => ({
            id: "melipayamak",
            supportedCapabilities: ["sms.send"],
            async sendMessage() {
              return { ok: false };
            },
            async sendSms(ctx, input) {
              providerTenant = ctx.tenantId;
              assert.deepEqual(input.variables, ["4826"]);
              return { ok: true };
            },
          }),
        }
      );
      assert.equal(result.ok, true);
      assert.equal(usageTenant, "tenant-denali");
      assert.equal(providerTenant, "tenant-denali");
    } finally {
      for (const name of names) {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
      }
    }
  });
  it("fails closed when a platform OTP job is tenant-attributed or has another purpose", async () => {
    let sends = 0;
    for (const overrides of [
      { tenantId: "tenant-denali", deliveryScope: "platform" as const },
      {
        tenantId: null,
        deliveryScope: "platform" as const,
        payload: {
          workspaceType: "platform",
          smsDeliverySource: "platform",
          smsPurpose: "member_login",
          recipient: "09224180093",
        },
      },
    ]) {
      const result = await executeIntegrationDeliveryJob(
        deliveryJob({
          provider: "melipayamak",
          capability: "sms.send",
          eventType: "auth.otp.requested",
          payload: {
            workspaceType: "platform",
            smsDeliverySource: "platform",
            smsPurpose: "platform_ops_login",
            recipient: "09224180093",
            ...overrides.payload,
          },
          tenantId: overrides.tenantId,
          deliveryScope: overrides.deliveryScope,
        }),
        {
          getProvider: () => ({
            id: "melipayamak",
            supportedCapabilities: ["sms.send"],
            async sendMessage() {
              return { ok: false };
            },
            async sendSms() {
              sends += 1;
              return { ok: true };
            },
          }),
        }
      );
      assert.equal(result.ok, false);
      assert.equal(result.error?.code, "PLATFORM_SMS_JOB_INVALID");
    }
    assert.equal(sends, 0);
  });
  it("sends only the numeric OTP as the approved single template variable", async () => {
    const previousKey = process.env.SMS_DELIVERY_ENCRYPTION_KEY;
    process.env.SMS_DELIVERY_ENCRYPTION_KEY = "44".repeat(32);
    let captured: { recipient: string; templateId: string; variables: readonly string[] } | null =
      null;
    try {
      const result = await executeIntegrationDeliveryJob(
        deliveryJob({
          provider: "melipayamak",
          capability: "sms.send",
          payload: {
            workspaceType: "denali",
            integrationConnectionId: "sms-connection",
            recipient: "+989121234567",
            smsTemplateId: "578050",
            smsEncryptedVariables: encryptOtpDeliveryCode("4826"),
            smsWorkspaceName: "دنالی",
          },
        }),
        {
          prepareSmsUsage: async () => "ready",
          recordSmsUsage: async () => {},
          resolveConnection: async () => ({
            id: "sms-connection",
            tenantId: "tenant-denali",
            workspaceType: "denali",
            provider: "melipayamak",
            status: "enabled",
            enabled: true,
            capabilities: ["sms.send"],
            config: { bodyId: "578050" },
            secretRef: "sms-secret",
            credentials: { username: "test", password: "not-used-in-test" },
            createdAt: new Date(0),
            updatedAt: new Date(0),
          }),
          getProvider: () => ({
            id: "melipayamak",
            supportedCapabilities: ["sms.send"],
            async sendMessage() {
              return { ok: false, errorCode: "UNEXPECTED_MESSAGE_SEND" };
            },
            async sendSms(_ctx, input) {
              captured = input;
              return { ok: true };
            },
          }),
        }
      );
      assert.deepEqual(result, { ok: true });
      assert.deepEqual(captured, {
        recipient: "+989121234567",
        templateId: "578050",
        variables: ["4826"],
      });
    } finally {
      if (previousKey === undefined) delete process.env.SMS_DELIVERY_ENCRYPTION_KEY;
      else process.env.SMS_DELIVERY_ENCRYPTION_KEY = previousKey;
    }
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

  it("does not retry an SMS with an unknown provider outcome", async () => {
    for (const code of ["MELIPAYAMAK_NETWORK_ERROR", "MELIPAYAMAK_SERVER_ERROR"]) {
      const events: string[] = [];
      const result = await processIntegrationDeliveryOnce(
        {
          deliveryRepository: repositoryFor(
            deliveryJob({ provider: "melipayamak", capability: "sms.send" }),
            events
          ),
          reclaimStaleProcessingJobs: async () => 0,
          executeJob: async () => ({ ok: false, error: { code } }),
        },
        1
      );
      assert.equal(result.retried, 0);
      assert.deepEqual(events, ["claim", `dead:${code}`]);
    }
  });

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

  it("completes a platform job without attributing metrics to a tenant", async () => {
    const events: string[] = [];
    const platformJob = deliveryJob({
      tenantId: null,
      deliveryScope: "platform",
      provider: "melipayamak",
      capability: "sms.send",
      eventType: "auth.otp.requested",
      payload: {
        workspaceType: "platform",
        smsDeliverySource: "platform",
        smsPurpose: "platform_ops_login",
      },
    });
    const repository: IntegrationDeliveryRepository = {
      ...repositoryFor(platformJob, events),
      async markDone(tenantId) {
        events.push(`done:${String(tenantId)}`);
      },
    };
    const result = await processIntegrationDeliveryOnce(
      {
        deliveryRepository: repository,
        reclaimStaleProcessingJobs: async () => 0,
        executeJob: async () => ({ ok: true }),
      },
      1
    );
    assert.equal(result.done, 1);
    assert.deepEqual(events, ["claim", "done:null"]);
  });
});
