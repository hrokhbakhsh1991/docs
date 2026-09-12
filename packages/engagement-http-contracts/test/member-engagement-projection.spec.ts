/**
 * MEG-001 / FDA-001 — member engagement projection tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MEMBER_ENGAGEMENT_HISTORY_LABEL_KEYS,
  projectMemberDisplayPoints,
  projectMemberPointEvent,
  projectMemberPointEvents,
} from "../src/member-engagement-projection";

describe("member-engagement-projection", () => {
  it("floors display points at zero", () => {
    assert.equal(projectMemberDisplayPoints(120), 120);
    assert.equal(projectMemberDisplayPoints(0), 0);
    assert.equal(projectMemberDisplayPoints(-15), 0);
    assert.equal(projectMemberDisplayPoints(-0), 0);
  });

  it("projects positive awards with pointsAwarded", () => {
    const projected = projectMemberPointEvent({
      id: "evt-1",
      pointsDelta: 50,
      sourceModule: "identity",
      sourceEventType: "profile.completed",
      sourceEntityId: null,
      reason: null,
      actorRole: null,
      createdAt: "2026-09-04T12:00:00.000Z",
    });
    assert.equal(projected.kind, "award");
    assert.equal(projected.pointsAwarded, 50);
    assert.equal(projected.labelKey, "eventTypes.profile_completed");
    assert.equal(projected.detailLabelKey, null);
  });

  it("projects manual negative adjustment as neutral correction", () => {
    const projected = projectMemberPointEvent({
      id: "evt-2",
      pointsDelta: -20,
      sourceModule: "engagement",
      sourceEventType: "engagement.points.manual_adjustment",
      sourceEntityId: null,
      reason: "internal operator note",
      actorRole: "admin",
      createdAt: "2026-09-04T12:05:00.000Z",
    });
    assert.equal(projected.kind, "correction");
    assert.equal(projected.pointsAwarded, null);
    assert.equal(projected.labelKey, MEMBER_ENGAGEMENT_HISTORY_LABEL_KEYS.correction);
  });

  it("projects reversal with expandable detail label", () => {
    const projected = projectMemberPointEvent({
      id: "evt-3",
      pointsDelta: -50,
      sourceModule: "engagement",
      sourceEventType: "engagement.points.reversed",
      sourceEntityId: "evt-1",
      reason: "duplicate award correction",
      actorRole: "owner",
      createdAt: "2026-09-04T12:10:00.000Z",
    });
    assert.equal(projected.kind, "reversal");
    assert.equal(projected.labelKey, MEMBER_ENGAGEMENT_HISTORY_LABEL_KEYS.reversal);
    assert.equal(projected.detailLabelKey, MEMBER_ENGAGEMENT_HISTORY_LABEL_KEYS.reversalDetail);
    assert.equal(projected.pointsAwarded, null);
  });

  it("projects history list in order", () => {
    const items = projectMemberPointEvents([
      {
        id: "a",
        pointsDelta: 100,
        sourceModule: "booking",
        sourceEventType: "registration.first_approved",
        sourceEntityId: null,
        reason: null,
        actorRole: null,
        createdAt: "2026-09-04T11:00:00.000Z",
      },
      {
        id: "b",
        pointsDelta: -100,
        sourceModule: "engagement",
        sourceEventType: "engagement.points.reversed",
        sourceEntityId: "a",
        reason: "test",
        actorRole: "admin",
        createdAt: "2026-09-04T11:05:00.000Z",
      },
    ]);
    assert.equal(items.length, 2);
    assert.equal(items[0]?.kind, "award");
    assert.equal(items[1]?.kind, "reversal");
  });
});
