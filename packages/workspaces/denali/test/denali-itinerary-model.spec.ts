import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDefaultItineraryDays,
  collectDenaliItineraryDayValidationIssues,
  dayHasRequiredItineraryContent,
  parseDenaliItineraryDays,
  pruneItinerarySegmentPhotoIds,
  syncDenaliItineraryRows,
} from "../src/schemas/denaliItineraryDaySchema";
import { sanitizeItineraryPhotoIdsOnDraft } from "../src/wizard/denali-wizard-catalog-sanitize";

describe("denali-itinerary-model.spec.ts", () => {
  it("DN-ITIN-01 migrates legacy activities string into a segment", () => {
    const days = parseDenaliItineraryDays([
      { day: 1, activities: "صعود به قله", locationText: "پناهگاه بارگاه" },
    ]);
    assert.equal(days.length, 1);
    assert.equal(days[0]?.dayNumber, 1);
    assert.equal(days[0]?.segments[0]?.title, "صعود به قله");
    assert.equal(days[0]?.segments[0]?.locationLabel, "پناهگاه بارگاه");
  });

  it("DN-ITIN-02 migrates description to summary", () => {
    const days = parseDenaliItineraryDays([
      {
        dayNumber: 2,
        title: "روز دوم",
        description: "پیاده‌روی در جنگل",
        segments: [{ id: "s1", kind: "activity", title: "کارگاه" }],
      },
    ]);
    assert.equal(days[0]?.summary, "پیاده‌روی در جنگل");
    assert.equal(days[0]?.segments[0]?.title, "کارگاه");
  });

  it("DN-ITIN-03 sync preserves segments when day count grows", () => {
    const synced = syncDenaliItineraryRows(
      [
        {
          dayNumber: 1,
          title: "روز اول",
          segments: [{ id: "s1", kind: "activity", title: "حرکت" }],
        },
      ],
      2
    );
    assert.equal(synced.length, 2);
    assert.equal(synced[0]?.segments[0]?.title, "حرکت");
    assert.equal(synced[1]?.segments.length, 1);
  });

  it("DN-ITIN-03b sync scaffolds titles for newly added days (FE-07)", () => {
    const synced = syncDenaliItineraryRows([], 3);
    assert.equal(synced.length, 3);
    assert.equal(synced[2]?.title, "Day 3");
    assert.equal(synced[2]?.segments[0]?.title, "Activity 3");
    assert.equal(dayHasRequiredItineraryContent(synced[2]!), true);
  });

  it("DN-ITIN-04 validation requires day title and at least one segment title", () => {
    const incomplete = buildDefaultItineraryDays(1);
    assert.equal(dayHasRequiredItineraryContent(incomplete[0]!), false);
    const issues = collectDenaliItineraryDayValidationIssues(incomplete);
    assert.ok(issues.length >= 2);

    const complete = [
      {
        dayNumber: 1,
        title: "ورود",
        segments: [{ id: "s1", kind: "activity" as const, title: "جلسه توجیه" }],
      },
    ];
    assert.equal(dayHasRequiredItineraryContent(complete[0]!), true);
    assert.equal(collectDenaliItineraryDayValidationIssues(complete).length, 0);
  });

  it("DN-ITIN-05 parses and dedupes segment photoIds", () => {
    const days = parseDenaliItineraryDays([
      {
        dayNumber: 1,
        title: "Day one",
        segments: [
          {
            id: "s1",
            kind: "activity",
            title: "Hike",
            photoIds: ["p1", "p1", " p2 ", ""],
          },
        ],
      },
    ]);
    assert.deepEqual(days[0]?.segments[0]?.photoIds, ["p1", "p2"]);
  });

  it("DN-ITIN-06 pruneItinerarySegmentPhotoIds removes orphan ids", () => {
    const days = parseDenaliItineraryDays([
      {
        dayNumber: 1,
        title: "Day one",
        segments: [
          {
            id: "s1",
            kind: "activity",
            title: "Hike",
            photoIds: ["p1", "missing"],
          },
        ],
      },
    ]);
    const pruned = pruneItinerarySegmentPhotoIds(days, new Set(["p1"]));
    assert.deepEqual(pruned[0]?.segments[0]?.photoIds, ["p1"]);

    const cleared = pruneItinerarySegmentPhotoIds(days, new Set());
    assert.equal(cleared[0]?.segments[0]?.photoIds, undefined);
  });

  it("DN-ITIN-07 sanitizeItineraryPhotoIdsOnDraft prunes stale refs on submit envelope", () => {
    const sanitized = sanitizeItineraryPhotoIdsOnDraft({
      data: {
        photos: [{ id: "p1", label: "Summit" }],
        program: {
          itinerary: [
            {
              dayNumber: 1,
              title: "Day one",
              segments: [
                {
                  id: "s1",
                  kind: "activity",
                  title: "Hike",
                  photoIds: ["p1", "gone"],
                },
              ],
            },
          ],
        },
      },
    });
    const itinerary = sanitized.data.program as { itinerary: unknown[] };
    const segment = (itinerary.itinerary[0] as { segments: Array<{ photoIds?: string[] }> })
      .segments[0];
    assert.deepEqual(segment?.photoIds, ["p1"]);
  });

  it("DN-ITIN-09 parses segment destinationId", () => {
    const days = parseDenaliItineraryDays([
      {
        dayNumber: 1,
        title: "Day one",
        segments: [
          {
            id: "s1",
            kind: "activity",
            title: "Workshop",
            destinationId: " dest-1 ",
          },
        ],
      },
    ]);
    assert.equal(days[0]?.segments[0]?.destinationId, "dest-1");
  });
});
