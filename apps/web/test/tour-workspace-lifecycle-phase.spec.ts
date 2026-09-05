import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTourWorkspaceLifecyclePhase } from "../src/features/tours/tour-workspace-lifecycle-phase";

describe("tour-workspace-lifecycle-phase", () => {
  const now = Date.parse("2026-09-05T12:00:00.000Z");

  it("draft tours are in design phase", () => {
    assert.equal(
      resolveTourWorkspaceLifecyclePhase({ uiStatus: "draft", departureAt: null }, now),
      "design",
    );
  });

  it("published tour with distant departure is selling", () => {
    assert.equal(
      resolveTourWorkspaceLifecyclePhase(
        { uiStatus: "active", departureAt: "2026-12-01T09:00:00.000Z" },
        now,
      ),
      "selling",
    );
  });

  it("published tour departing within 7 days is running", () => {
    assert.equal(
      resolveTourWorkspaceLifecyclePhase(
        { uiStatus: "active", departureAt: "2026-09-10T09:00:00.000Z" },
        now,
      ),
      "running",
    );
  });
});
