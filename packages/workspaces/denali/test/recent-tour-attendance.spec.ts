import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import {
  guestHasApprovedOnEachTour,
  parseDenaliAutoApproveMinRecentTours,
  readDenaliAutoApproveMinRecentToursFromCanonical,
  selectLastPublishedTourIds,
} from "../src/booking/recent-tour-attendance.ts";

function tour(id: string, start: string, publishStatus: "active" | "draft" = "active") {
  return {
    id,
    canonical: createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics"],
      data: {
        title: id,
        publishStatus,
        startDateTime: start,
      },
    }),
  };
}

describe("recent-tour-attendance — Denali Phase 3.2", () => {
  it("parses 1|2|3 and rejects 0 / garbage", () => {
    assert.equal(parseDenaliAutoApproveMinRecentTours(2), 2);
    assert.equal(parseDenaliAutoApproveMinRecentTours("3"), 3);
    assert.equal(parseDenaliAutoApproveMinRecentTours(0), null);
    assert.equal(parseDenaliAutoApproveMinRecentTours(""), null);
    assert.equal(parseDenaliAutoApproveMinRecentTours("4"), null);
  });

  it("reads nested participants.autoApproveMinRecentTours from canonical", () => {
    const canonical = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["basics"],
      data: { participants: { autoApproveMinRecentTours: "2" } },
    });
    assert.equal(readDenaliAutoApproveMinRecentToursFromCanonical(canonical), 2);
  });

  it("ranks last N published tours before cutoff and skips current / draft / future", () => {
    const current = "tour-now";
    const ranked = selectLastPublishedTourIds({
      tours: [
        tour(current, "2026-06-01T08:00:00.000Z"),
        tour("future", "2026-07-01T08:00:00.000Z"),
        tour("draft", "2026-05-20T08:00:00.000Z", "draft"),
        tour("old-b", "2026-05-10T08:00:00.000Z"),
        tour("old-a", "2026-05-15T08:00:00.000Z"),
        { id: "no-start", canonical: createCanonicalDocument({
          schemaVersion: 1,
          roots: ["basics"],
          data: { publishStatus: "active" },
        }) },
      ],
      excludeTourId: current,
      beforeStartMs: Date.parse("2026-06-01T08:00:00.000Z"),
      take: 2,
    });
    assert.deepEqual(ranked, ["old-a", "old-b"]);
  });

  it("fail-closes when club has fewer than N past published tours", () => {
    const ranked = selectLastPublishedTourIds({
      tours: [tour("only", "2026-05-01T08:00:00.000Z")],
      excludeTourId: "current",
      beforeStartMs: Date.parse("2026-06-01T08:00:00.000Z"),
      take: 2,
    });
    assert.equal(ranked, null);
  });

  it("requires approved attendance on each required tour", () => {
    assert.equal(guestHasApprovedOnEachTour(["a", "b"], ["b", "a"]), true);
    assert.equal(guestHasApprovedOnEachTour(["a"], ["a", "b"]), false);
    assert.equal(guestHasApprovedOnEachTour(["a", "b"], []), false);
  });
});
