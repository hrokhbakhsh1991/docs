import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { dispatchMemberNotificationFromOutbox } from "./dispatch-member-notification-from-outbox";
import {
  listMemberNotifications,
  resetMemberNotificationInboxForTests,
} from "./member-notification.repository";

const TENANT_ID = "00000000-0000-4000-8000-000000000014";
const USER_ID = "00000000-0000-4000-8000-000000000015";
const REGISTRATION_ID = "00000000-0000-4000-8000-000000000016";

describe("member notification outbox mapping", () => {
  afterEach(() => resetMemberNotificationInboxForTests());

  it("maps approved receipt to the member registration and preserves social link", async () => {
    await dispatchMemberNotificationFromOutbox({
      tenantId: TENANT_ID,
      aggregateType: "registration",
      aggregateId: REGISTRATION_ID,
      eventType: "finance.receipt.approved",
      domainEventId: "finance.receipt.approved:receipt-1",
      payload: {
        registrationId: REGISTRATION_ID,
        guestUserId: USER_ID,
        socialMediaLink: "https://t.me/example-group",
      },
      createdAt: new Date(),
      correlationId: "finance.receipt.approved:receipt-1",
    });

    const result = await listMemberNotifications({
      tenantId: TENANT_ID,
      userId: USER_ID,
      limit: 20,
    });
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.eventType, "finance.receipt.approved");
    assert.equal(result.items[0]?.entityType, "registration");
    assert.equal(result.items[0]?.entityId, REGISTRATION_ID);
    assert.equal(result.items[0]?.payload.socialMediaLink, "https://t.me/example-group");
  });
});
