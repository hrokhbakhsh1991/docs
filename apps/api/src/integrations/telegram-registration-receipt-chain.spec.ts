import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { dispatchIntegrationDomainEvent } from "./application/dispatch-integration-domain-event";
import type { IntegrationPolicyEngine } from "./application/integration-policy-engine";
import type { IntegrationDeliveryRepository } from "./infrastructure/prisma-integration-delivery.repository";
import type { IntegrationDeliveryJobRecord } from "./platform/integration-delivery.types";
import { executeIntegrationDeliveryJob } from "./worker/process-integration-delivery-once";

const TENANT_ID = "tenant-denali";
const CONNECTION_ID = "telegram-denali";

function deliveryRepository(jobs: Array<Record<string, unknown>>): IntegrationDeliveryRepository {
  return {
    async enqueueJob(input) {
      jobs.push(input);
      return true;
    },
    async claimPendingBatch() {
      return [];
    },
    async markDone() {},
    async markFailedForRetry() {},
    async markDead() {},
  };
}

function policyEngineFor(eventType: string, topicKey: string): IntegrationPolicyEngine {
  return {
    evaluate: async () => [
      {
        connectionId: CONNECTION_ID,
        tenantId: TENANT_ID,
        provider: "telegram",
        capability: "message.send",
        topicKey,
        workspaceType: "denali",
        exposureCoordinate: {
          surface: "telegram",
          audience: "external_channel",
          trigger: eventType,
        },
        exposureIntent: null,
      },
    ],
  };
}

describe("Denali Telegram registration/receipt delivery chain", () => {
  const previousDispatcherFlag = process.env.INTEGRATION_DELIVERY_ENABLED;

  beforeEach(() => {
    process.env.INTEGRATION_DELIVERY_ENABLED = "true";
  });

  afterEach(() => {
    if (previousDispatcherFlag === undefined) {
      delete process.env.INTEGRATION_DELIVERY_ENABLED;
    } else {
      process.env.INTEGRATION_DELIVERY_ENABLED = previousDispatcherFlag;
    }
  });

  it("dispatches and delivers each event to its mapped forum topic", async () => {
    const cases = [
      {
        eventType: "registration.created",
        topicKey: "registration",
        payload: {
          guestLabel: "QA Member",
          tourTitle: "QA Tour",
          departureAt: "2026-09-20",
          partySize: 1,
          approvalStatus: "awaiting_approval",
        },
      },
      {
        eventType: "registration.approved",
        topicKey: "registration",
        payload: {
          bookingId: "registration-1",
          approvedAt: "2026-09-19T10:01:00.000Z",
        },
      },
      {
        eventType: "receipt.submitted",
        topicKey: "receipts",
        payload: {
          registrationId: "registration-1",
          paymentId: "payment-1",
          amount: "2500000",
          currency: "IRR",
          submittedAt: "2026-09-19T10:00:00.000Z",
        },
      },
      {
        eventType: "receipt.approved",
        topicKey: "receipts",
        payload: {
          receiptId: "receipt-1",
          registrationId: "registration-1",
          reviewedAt: "2026-09-19T10:02:00.000Z",
          bookingPaymentStatus: "partial",
        },
      },
      {
        eventType: "receipt.rejected",
        topicKey: "receipts",
        payload: {
          receiptId: "receipt-2",
          registrationId: "registration-1",
          reviewedAt: "2026-09-19T10:03:00.000Z",
          reviewNote: "تصویر خوانا نیست",
        },
      },
      {
        eventType: "ticket.created",
        topicKey: "tickets",
        payload: {
          ticketId: "ticket-1",
          createdAt: "2026-09-19T10:04:00.000Z",
          subject: "پرسش درباره حرکت",
        },
      },
      {
        eventType: "ticket.message.posted",
        topicKey: "tickets",
        payload: {
          ticketId: "ticket-1",
          subject: "پرسش درباره حرکت",
          status: "open",
        },
      },
    ] as const;
    const sent: Array<{ eventType: string; channelId: string; threadId?: number }> = [];

    for (const [index, testCase] of cases.entries()) {
      const jobs: Array<Record<string, unknown>> = [];
      const enqueued = await dispatchIntegrationDomainEvent(
        {
          tenantId: TENANT_ID,
          domainEventId: `qa-chain-${index}`,
          eventType: testCase.eventType,
          aggregateType: "registration",
          aggregateId: "registration-1",
          payload: testCase.payload,
        },
        {
          policyEngine: policyEngineFor(testCase.eventType, testCase.topicKey),
          deliveryRepository: deliveryRepository(jobs),
          resolveWorkspaceType: async () => "denali",
          resolvePersistedExposureProfileForContext: async () => null,
        }
      );

      assert.equal(enqueued, 1, testCase.eventType);
      const input = jobs[0]!;
      const job = {
        ...input,
        id: `job-${index}`,
        status: "pending" as const,
        attemptCount: 0,
        nextAttemptAt: null,
      } as IntegrationDeliveryJobRecord;
      const result = await executeIntegrationDeliveryJob(job, {
        resolveConnection: async () => ({
          id: CONNECTION_ID,
          tenantId: TENANT_ID,
          workspaceType: "denali",
          provider: "telegram",
          status: "enabled",
          enabled: true,
          capabilities: ["message.send"],
          config: {
            chatId: "-1004292581496",
            topicThreadIds: { registration: 101, receipts: 202, tickets: 303 },
          },
          secretRef: "telegram-secret",
          credentials: { botToken: "test-token" },
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }),
        getProvider: () => ({
          id: "telegram",
          supportedCapabilities: ["message.send"],
          async sendMessage(_context, message) {
            sent.push({
              eventType: job.eventType,
              channelId: message.channelId,
              threadId: message.messageThreadId,
            });
            return { ok: true };
          },
        }),
      });

      assert.deepEqual(result, { ok: true }, testCase.eventType);
    }

    assert.deepEqual(sent, [
      { eventType: "registration.created", channelId: "-1004292581496", threadId: 101 },
      { eventType: "registration.approved", channelId: "-1004292581496", threadId: 101 },
      { eventType: "receipt.submitted", channelId: "-1004292581496", threadId: 202 },
      { eventType: "receipt.approved", channelId: "-1004292581496", threadId: 202 },
      { eventType: "receipt.rejected", channelId: "-1004292581496", threadId: 202 },
      { eventType: "ticket.created", channelId: "-1004292581496", threadId: 303 },
      { eventType: "ticket.message.posted", channelId: "-1004292581496", threadId: 303 },
    ]);
  });
});
