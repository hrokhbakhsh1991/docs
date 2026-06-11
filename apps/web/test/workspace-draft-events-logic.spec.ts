/**
 * Phase 11.11 — draft events timeline logic (WEB-P11-11-01…03)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveWorkspaceDraftEventMessageKey,
  shouldShowWorkspaceDraftEventsTimeline,
  sliceWorkspaceDraftEventsForDisplay,
  WORKSPACE_DRAFT_EVENTS_DISPLAY_LIMIT,
} from "../src/draft/workspace-draft-events-logic";
import type { WorkspaceDraftEventListItem } from "../src/draft/workspace-draft-types";

const sampleEvent = (
  action: WorkspaceDraftEventListItem["action"],
  id: string
): WorkspaceDraftEventListItem => ({
  id,
  action,
  version: 1,
  schemaVersion: 1,
  actorUserId: "user-1",
  occurredAt: "2026-06-11T12:00:00.000Z",
});

describe("workspace-draft-events-logic.spec.ts — Phase 11.11", () => {
  it("WEB-P11-11-01 hides timeline while loading or when empty", () => {
    assert.equal(shouldShowWorkspaceDraftEventsTimeline(true, [sampleEvent("created", "1")]), false);
    assert.equal(shouldShowWorkspaceDraftEventsTimeline(false, []), false);
    assert.equal(
      shouldShowWorkspaceDraftEventsTimeline(false, [sampleEvent("updated", "1")]),
      true
    );
  });

  it("WEB-P11-11-03 maps action to i18n keys", () => {
    assert.equal(resolveWorkspaceDraftEventMessageKey("created"), "host.draftEvents.action.created");
    assert.equal(resolveWorkspaceDraftEventMessageKey("deleted"), "host.draftEvents.action.deleted");
  });

  it("WEB-P11-11-02 caps visible events for display", () => {
    const items = Array.from({ length: WORKSPACE_DRAFT_EVENTS_DISPLAY_LIMIT + 3 }, (_, index) =>
      sampleEvent("updated", `evt-${index}`)
    );
    assert.equal(sliceWorkspaceDraftEventsForDisplay(items).length, WORKSPACE_DRAFT_EVENTS_DISPLAY_LIMIT);
  });
});
