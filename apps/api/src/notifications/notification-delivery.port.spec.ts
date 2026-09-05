/**
 * SK2.C — NotificationDeliveryPort: tenant required + idempotent in_app deliver.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { BOOKING_APPROVE_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import {
  getInAppNotificationAdapterForTests,
  getNotificationDeliveryPort,
  resetNotificationDeliveryForTests,
  setNotificationDeliveryPortForTests,
} from "./create-notification-delivery";
import { dispatchRegistrationApprovedNotification } from "./dispatch-registration-approved-notification";
import { InAppStructuredNotificationAdapter } from "./in-app-structured-notification.adapter";
import {
  NOTIFICATION_CORRELATION_REQUIRED,
  NOTIFICATION_TENANT_REQUIRED,
} from "./notification-delivery.port";

describe("SK2.C notification delivery", () => {
  afterEach(() => {
    resetNotificationDeliveryForTests();
  });

  it("requires tenantId on deliver", async () => {
    const adapter = new InAppStructuredNotificationAdapter();
    await assert.rejects(
      () =>
        adapter.deliver({
          tenantId: "  ",
          channel: "in_app",
          templateId: "t",
          recipient: {},
          payload: {},
          correlationId: "corr-1",
        }),
      new RegExp(NOTIFICATION_TENANT_REQUIRED)
    );
  });

  it("requires correlationId on deliver", async () => {
    const adapter = new InAppStructuredNotificationAdapter();
    await assert.rejects(
      () =>
        adapter.deliver({
          tenantId: "00000000-0000-4000-8000-000000000014",
          channel: "in_app",
          templateId: "t",
          recipient: {},
          payload: {},
          correlationId: "",
        }),
      new RegExp(NOTIFICATION_CORRELATION_REQUIRED)
    );
  });

  it("idempotent: second deliver with same tenant+correlation+channel does not double-sink", async () => {
    const adapter = new InAppStructuredNotificationAdapter();
    setNotificationDeliveryPortForTests(adapter);

    const command = {
      tenantId: "00000000-0000-4000-8000-000000000014",
      channel: "in_app" as const,
      templateId: "booking.registration.approved",
      recipient: { address: "guest@example.com" },
      payload: { bookingId: "b1" },
      correlationId: "registration.approved:b1:t",
    };

    assert.deepEqual(await adapter.deliver(command), { ok: true });
    assert.deepEqual(await adapter.deliver(command), { ok: true });
    assert.equal(adapter.deliveredCountForTests(), 1);
  });

  it("dispatch maps registration.approved and no-ops other events", async () => {
    const adapter = new InAppStructuredNotificationAdapter();
    setNotificationDeliveryPortForTests(adapter);

    const skipped = await dispatchRegistrationApprovedNotification({
      tenantId: "00000000-0000-4000-8000-000000000014",
      domainEventId: "other:1",
      eventType: "TourCreated",
      aggregateType: "tour",
      aggregateId: "t1",
      payload: {},
    });
    assert.equal(skipped, null);
    assert.equal(adapter.deliveredCountForTests(), 0);

    const delivered = await dispatchRegistrationApprovedNotification(
      {
        tenantId: "00000000-0000-4000-8000-000000000014",
        domainEventId: "registration.approved:b1:2026-07-21T00:00:00.000Z",
        eventType: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
        aggregateType: "registration",
        aggregateId: "b1",
        payload: {
          bookingId: "b1",
          tourId: "tour-1",
          status: "approved",
          guestEmail: "guest@example.com",
        },
      },
      {
        resolveFlags: async () => ({
          advancedRuleEngine: true,
          inAppRegistrationApprovedNotify: true,
        }),
      }
    );
    assert.deepEqual(delivered, { ok: true });
    assert.equal(adapter.deliveredCountForTests(), 1);

    const again = await dispatchRegistrationApprovedNotification(
      {
        tenantId: "00000000-0000-4000-8000-000000000014",
        domainEventId: "registration.approved:b1:2026-07-21T00:00:00.000Z",
        eventType: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
        aggregateType: "registration",
        aggregateId: "b1",
        payload: { bookingId: "b1" },
      },
      {
        resolveFlags: async () => ({
          advancedRuleEngine: true,
          inAppRegistrationApprovedNotify: true,
        }),
      }
    );
    assert.deepEqual(again, { ok: true });
    assert.equal(adapter.deliveredCountForTests(), 1);
  });

  it("SK3 flag inAppRegistrationApprovedNotify=false skips deliver", async () => {
    const adapter = new InAppStructuredNotificationAdapter();
    setNotificationDeliveryPortForTests(adapter);

    const gated = await dispatchRegistrationApprovedNotification(
      {
        tenantId: "00000000-0000-4000-8000-000000000014",
        domainEventId: "registration.approved:b2:2026-07-21T00:00:00.000Z",
        eventType: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
        aggregateType: "registration",
        aggregateId: "b2",
        payload: { bookingId: "b2" },
      },
      {
        resolveFlags: async () => ({
          advancedRuleEngine: true,
          inAppRegistrationApprovedNotify: false,
        }),
      }
    );
    assert.equal(gated, null);
    assert.equal(adapter.deliveredCountForTests(), 0);
  });

  it("SEC-042 parse defaults skip legacy deliver unless tenant opts in", async () => {
    const adapter = new InAppStructuredNotificationAdapter();
    setNotificationDeliveryPortForTests(adapter);
    const { parseFeatureFlagsFromTheme } = await import("../tenant/resolve-tenant-feature-flags");

    const defaultGated = await dispatchRegistrationApprovedNotification(
      {
        tenantId: "00000000-0000-4000-8000-000000000014",
        domainEventId: "registration.approved:b3:2026-09-05T00:00:00.000Z",
        eventType: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
        aggregateType: "registration",
        aggregateId: "b3",
        payload: { bookingId: "b3", guestEmail: "guest@example.com" },
      },
      {
        resolveFlags: async () => parseFeatureFlagsFromTheme(null),
      },
    );
    assert.equal(defaultGated, null);
    assert.equal(adapter.deliveredCountForTests(), 0);
  });

  it("default composition exposes in_app adapter", () => {
    const port = getNotificationDeliveryPort();
    assert.ok(port);
    assert.ok(getInAppNotificationAdapterForTests());
  });
});
