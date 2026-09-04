/**
 * MEG-001 — operator engagement ops logic tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEngagementMemberLookupPath,
  engagementEventTypeLabelKey,
  formatEngagementTimestamp,
  resolveLevelProgressPercent,
  validateEngagementMemberUserId,
} from "../src/engagement/engagement-ops-logic";

describe("engagement-ops-logic", () => {
  it("resolves level progress percent between thresholds", () => {
    assert.equal(resolveLevelProgressPercent(50, "base_camp", 50), 50);
    assert.equal(resolveLevelProgressPercent(250, "summit_circle", null), 100);
  });

  it("maps event types to message keys", () => {
    assert.equal(engagementEventTypeLabelKey("profile.completed"), "eventTypes.profile_completed");
  });

  it("formats timestamps for locale", () => {
    const formatted = formatEngagementTimestamp("2026-01-15T10:30:00.000Z", "en-US");
    assert.notEqual(formatted, "2026-01-15T10:30:00.000Z");
  });

  it("validates member user id", () => {
    assert.equal(validateEngagementMemberUserId("not-a-uuid").ok, false);
    assert.equal(validateEngagementMemberUserId("00000000-0000-4000-8000-000000000001").ok, true);
  });

  it("builds member lookup path", () => {
    assert.equal(
      buildEngagementMemberLookupPath("00000000-0000-4000-8000-000000000001"),
      "/api/engagement/members/00000000-0000-4000-8000-000000000001",
    );
  });
});
