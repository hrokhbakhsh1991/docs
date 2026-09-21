/**
 * MEG-001 — engagement policy unit tests (levels, badges, award rules).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_ENGAGEMENT_AWARD_RULES,
  DEFAULT_ENGAGEMENT_BADGES,
  DEFAULT_ENGAGEMENT_LEVELS,
  resolveLevelForPoints,
  resolveNextLevel,
} from "./engagement-policy";

describe("engagement-policy", () => {
  it("resolves level thresholds deterministically", () => {
    assert.equal(resolveLevelForPoints(0).code, "base_camp");
    assert.equal(resolveLevelForPoints(100).code, "trail_member");
    assert.equal(resolveLevelForPoints(250).code, "summit_circle");
  });

  it("resolves next level or null at summit", () => {
    assert.equal(resolveNextLevel(0)?.code, "trail_member");
    assert.equal(resolveNextLevel(250), null);
  });

  it("keeps award rules separate from wallet semantics", () => {
    for (const rule of DEFAULT_ENGAGEMENT_AWARD_RULES) {
      assert.ok(rule.points > 0);
      assert.notEqual(rule.sourceModule, "wallet");
    }
    assert.equal(DEFAULT_ENGAGEMENT_LEVELS.length, 3);
  });

  it("ships human-readable seed copy instead of translation keys", () => {
    for (const badge of DEFAULT_ENGAGEMENT_BADGES) {
      assert.ok(badge.titleI18n?.en);
      assert.ok(badge.titleI18n?.fa);
      assert.ok(badge.descriptionI18n?.en);
      assert.ok(badge.descriptionI18n?.fa);
      assert.doesNotMatch(badge.titleI18n?.fa ?? "", /^engagement\./);
      assert.doesNotMatch(badge.descriptionI18n?.fa ?? "", /^engagement\./);
    }
    for (const level of DEFAULT_ENGAGEMENT_LEVELS) {
      assert.ok(level.titleI18n?.en);
      assert.ok(level.titleI18n?.fa);
      assert.doesNotMatch(level.titleI18n?.fa ?? "", /^engagement\./);
    }
  });
});
