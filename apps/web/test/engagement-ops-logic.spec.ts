/**
 * MEG-001 — operator engagement ops logic tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEngagementAdjustPath,
  buildEngagementAuditLogPath,
  buildEngagementAwardRuleUpdatePath,
  buildEngagementAwardRulesPath,
  buildEngagementBadgeUpdatePath,
  buildEngagementBadgesPath,
  buildEngagementCatalogPath,
  buildEngagementLevelUpdatePath,
  buildEngagementLevelsPath,
  buildEngagementMemberLookupPath,
  buildEngagementMemberSearchPath,
  buildEngagementPolicyPath,
  buildEngagementReversePath,
  createEngagementIdempotencyKey,
  engagementEventTypeLabelKey,
  formatEngagementTimestamp,
  resolveLevelProgressPercent,
  resolveEngagementSupportedEventTypes,
  sortEngagementLevelsByMinPoints,
  validateEngagementAdjustmentForm,
  validateEngagementAwardRuleCreateForm,
  validateEngagementBadgeCreateForm,
  validateEngagementLevelCreateForm,
  validateEngagementMemberUserId,
  validateEngagementReversalForm,
  canReverseEngagementPointEvent,
} from "../src/engagement/engagement-ops-logic";

describe("engagement-ops-logic", () => {
  it("resolves level progress percent between thresholds", () => {
    assert.equal(resolveLevelProgressPercent(50, "base_camp", 50), 50);
    assert.equal(resolveLevelProgressPercent(250, "summit_circle", null), 100);
  });

  it("maps event types to message keys", () => {
    assert.equal(engagementEventTypeLabelKey("profile.completed"), "eventTypes.profile_completed");
  });

  it("falls back to supported award events when catalog is empty", () => {
    assert.deepEqual(resolveEngagementSupportedEventTypes(null), [
      "profile.completed",
      "registration.first_approved",
    ]);
    assert.deepEqual(
      resolveEngagementSupportedEventTypes({
        supportedEvents: [{ eventType: "profile.completed" }],
      }),
      ["profile.completed"],
    );
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

  it("builds policy and mutation paths", () => {
    assert.equal(buildEngagementPolicyPath(), "/api/engagement/policy");
    assert.equal(buildEngagementBadgesPath(), "/api/engagement/badges");
    assert.equal(buildEngagementBadgeUpdatePath("trail_star"), "/api/engagement/badges/trail_star");
    assert.equal(buildEngagementLevelsPath(), "/api/engagement/levels");
    assert.equal(buildEngagementLevelUpdatePath("summit"), "/api/engagement/levels/summit");
    assert.equal(buildEngagementAwardRulesPath(), "/api/engagement/award-rules");
    assert.equal(
      buildEngagementAwardRuleUpdatePath("00000000-0000-4000-8000-000000000099"),
      "/api/engagement/award-rules/00000000-0000-4000-8000-000000000099",
    );
    assert.match(buildEngagementAuditLogPath(), /\/api\/engagement\/audit-log\?limit=50/);
    assert.equal(buildEngagementCatalogPath(), "/api/engagement/catalog");
    assert.equal(
      buildEngagementAdjustPath("00000000-0000-4000-8000-000000000001"),
      "/api/engagement/members/00000000-0000-4000-8000-000000000001/adjust",
    );
    assert.equal(
      buildEngagementReversePath("00000000-0000-4000-8000-000000000001"),
      "/api/engagement/members/00000000-0000-4000-8000-000000000001/reverse",
    );
    assert.match(buildEngagementMemberSearchPath("ali"), /search=ali/);
  });

  it("validates admin badge, level, and award rule forms", () => {
    assert.equal(
      validateEngagementBadgeCreateForm(
        {
          code: "Bad",
          titleEn: "T",
          titleFa: "ت",
          descriptionEn: "D",
          descriptionFa: "د",
          iconKey: "mountain",
          triggerKind: "event",
          triggerEventType: "profile.completed",
          triggerMinPoints: "",
        },
        ["profile.completed"],
      ).ok,
      false,
    );
    assert.equal(
      validateEngagementBadgeCreateForm(
        {
          code: "smk_test_badge",
          titleEn: "Test",
          titleFa: "تست",
          descriptionEn: "Desc",
          descriptionFa: "توضیح",
          iconKey: "mountain",
          triggerKind: "event",
          triggerEventType: "profile.completed",
          triggerMinPoints: "",
        },
        ["profile.completed"],
      ).ok,
      true,
    );
    assert.equal(
      validateEngagementLevelCreateForm(
        {
          code: "peak",
          titleEn: "Peak",
          titleFa: "قله",
          descriptionEn: "D",
          descriptionFa: "د",
          minPoints: "100",
          sortOrder: "1",
        },
        [0, 50],
      ).ok,
      true,
    );
    assert.equal(
      validateEngagementLevelCreateForm(
        {
          code: "dup",
          titleEn: "Dup",
          titleFa: "تکرار",
          descriptionEn: "D",
          descriptionFa: "د",
          minPoints: "50",
          sortOrder: "0",
        },
        [50],
      ).ok,
      false,
    );
    assert.equal(
      validateEngagementAwardRuleCreateForm(
        { eventType: "profile.completed", points: "25", badgeCode: "" },
        ["profile.completed"],
      ).ok,
      true,
    );
  });

  it("sorts levels by min points", () => {
    const sorted = sortEngagementLevelsByMinPoints([
      { code: "b", minPoints: 100, sortOrder: 0 },
      { code: "a", minPoints: 0, sortOrder: 0 },
    ]);
    assert.deepEqual(sorted.map((item) => item.code), ["a", "b"]);
  });

  it("validates adjustment and reversal forms", () => {
    assert.equal(validateEngagementAdjustmentForm({ pointsDelta: "", reason: "ok" }).ok, false);
    assert.equal(
      validateEngagementAdjustmentForm({ pointsDelta: "10", reason: "manual bonus" }).ok,
      true,
    );
    assert.equal(validateEngagementReversalForm({ reason: "x" }).ok, false);
    assert.equal(validateEngagementReversalForm({ reason: "duplicate award" }).ok, true);
  });

  it("detects reversible events", () => {
    assert.equal(
      canReverseEngagementPointEvent({ pointsDelta: 50, sourceEventType: "profile.completed" }),
      true,
    );
    assert.equal(
      canReverseEngagementPointEvent({
        pointsDelta: -50,
        sourceEventType: "engagement.points.reversed",
      }),
      false,
    );
  });

  it("creates idempotency keys", () => {
    assert.match(createEngagementIdempotencyKey("adjust"), /^adjust-/);
    assert.notEqual(
      createEngagementIdempotencyKey("adjust"),
      createEngagementIdempotencyKey("adjust"),
    );
  });
});
