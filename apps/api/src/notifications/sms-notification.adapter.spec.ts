/**
 * SK2 SMS adapter — feature flag and contract tests.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  SMS_NOTIFICATION_DISABLED,
  SmsNotificationAdapter,
  isSmsNotificationEnabled,
} from "./sms-notification.adapter";
import { ComposedNotificationDeliveryPort } from "./composed-notification-delivery.port";
import {
  NOTIFICATION_CORRELATION_REQUIRED,
  NOTIFICATION_TENANT_REQUIRED,
} from "./notification-delivery.port";

describe("SK2 SMS notification adapter", () => {
  const priorSmsEnabled = process.env.SMS_ENABLED;

  afterEach(() => {
    if (priorSmsEnabled === undefined) {
      delete process.env.SMS_ENABLED;
    } else {
      process.env.SMS_ENABLED = priorSmsEnabled;
    }
  });

  it("defaults SMS_ENABLED to false", () => {
    delete process.env.SMS_ENABLED;
    assert.equal(isSmsNotificationEnabled(), false);
  });

  it("respects SMS_ENABLED=true without faking delivery", async () => {
    process.env.SMS_ENABLED = "true";
    const adapter = new SmsNotificationAdapter();
    const result = await adapter.deliver({
      tenantId: "00000000-0000-4000-8000-000000000014",
      channel: "sms",
      templateId: "finance.payment.confirmed",
      recipient: { userId: "00000000-0000-4000-8000-000000000015" },
      payload: {},
      correlationId: "sms-corr-1",
    });
    assert.deepEqual(result, { ok: false, retryable: false });
  });

  it("returns non-retryable failure when SMS disabled", async () => {
    delete process.env.SMS_ENABLED;
    const adapter = new SmsNotificationAdapter();
    const result = await adapter.deliver({
      tenantId: "00000000-0000-4000-8000-000000000014",
      channel: "sms",
      templateId: "booking.registration.approved",
      recipient: {},
      payload: {},
      correlationId: "sms-corr-2",
    });
    assert.deepEqual(result, { ok: false, retryable: false });
  });

  it("requires tenantId and correlationId", async () => {
    const adapter = new SmsNotificationAdapter();
    await assert.rejects(
      () =>
        adapter.deliver({
          tenantId: "",
          channel: "sms",
          templateId: "t",
          recipient: {},
          payload: {},
          correlationId: "c1",
        }),
      new RegExp(NOTIFICATION_TENANT_REQUIRED),
    );
    await assert.rejects(
      () =>
        adapter.deliver({
          tenantId: "00000000-0000-4000-8000-000000000014",
          channel: "sms",
          templateId: "t",
          recipient: {},
          payload: {},
          correlationId: "",
        }),
      new RegExp(NOTIFICATION_CORRELATION_REQUIRED),
    );
  });

  it("composed port routes sms channel to SMS adapter", async () => {
    delete process.env.SMS_ENABLED;
    const composed = new ComposedNotificationDeliveryPort();
    const smsResult = await composed.deliver({
      tenantId: "00000000-0000-4000-8000-000000000014",
      channel: "sms",
      templateId: "t",
      recipient: {},
      payload: {},
      correlationId: "composed-sms-1",
    });
    assert.deepEqual(smsResult, { ok: false, retryable: false });

    const inAppResult = await composed.deliver({
      tenantId: "00000000-0000-4000-8000-000000000014",
      channel: "in_app",
      templateId: "t",
      recipient: { address: "a@b.c" },
      payload: {},
      correlationId: "composed-inapp-1",
    });
    assert.deepEqual(inAppResult, { ok: true });
    assert.equal(composed.inApp.deliveredCountForTests(), 1);
  });

  it("exports SMS_NOTIFICATION_DISABLED constant for observability", () => {
    assert.equal(SMS_NOTIFICATION_DISABLED, "SMS_NOTIFICATION_DISABLED");
  });
});
