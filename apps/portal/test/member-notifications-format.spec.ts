import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isRawTranslationKey,
  readEngagementBadgeCode,
  resolveNotificationBodyForLocale,
} from "../src/me/notifications/member-notifications-format";

describe("member notification translation safety", () => {
  it("recognizes engagement payload keys as raw translations", () => {
    assert.equal(isRawTranslationKey("engagement.badge.summit_rookie.label"), true);
    assert.equal(isRawTranslationKey("امتیاز جدیدی گرفتید"), false);
  });

  it("uses the localized generic body instead of leaking an engagement key", () => {
    assert.equal(
      resolveNotificationBodyForLocale({
        title: "اعلان جدید",
        body: "engagement.badge.summit_rookie.description",
        locale: "fa",
        entityId: null,
        ticketFallback: (ticketRef) => `تیکت ${ticketRef}`,
        genericFallback: "به‌روزرسانی جدیدی دارید.",
      }),
      "به‌روزرسانی جدیدی دارید."
    );
  });

  it("extracts badge codes from persisted label or description keys", () => {
    assert.equal(
      readEngagementBadgeCode(["engagement.badge.summit_rookie.label"]),
      "summit_rookie"
    );
    assert.equal(
      readEngagementBadgeCode(["engagement.badge.first_expedition.description"]),
      "first_expedition"
    );
    assert.equal(readEngagementBadgeCode(["به‌روزرسانی جدیدی دارید."]), null);
  });
});
