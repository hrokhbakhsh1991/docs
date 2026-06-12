import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyDenaliStructuralInvariants } from "../src/normalize/structuralInvariants";
import { buildDenaliTourCreateDefaultValues } from "../src/schemas/denaliCore.schema";
import {
  parseDenaliItineraryDays,
  remapItinerarySegmentPhotoIds,
} from "../src/schemas/denaliItineraryDaySchema";
import { denaliRuleSet } from "../src/rules/denaliRuleModel";

describe("denali-itinerary-photo-invariants.spec.ts", () => {
  it("DN-ITIN-08 applyDenaliStructuralInvariants prunes orphan segment photoIds", () => {
    const form = buildDenaliTourCreateDefaultValues();
    form.basicInfo.tourType = "mountain_multi";
    form.basicInfo.startDateTime = "2026-06-01T08:00:00.000Z";
    form.basicInfo.endDateTime = "2026-06-03T18:00:00.000Z";
    form.photosData.photos = [{ id: "p1", label: "Summit" }];
    form.programNature.itinerary = [
      {
        dayNumber: 1,
        title: "Day one",
        segments: [
          {
            id: "s1",
            kind: "activity",
            title: "Hike",
            photoIds: ["p1", "removed"],
          },
        ],
      },
    ];

    const next = applyDenaliStructuralInvariants(form, undefined, denaliRuleSet);
    assert.deepEqual(next.programNature.itinerary?.[0]?.segments[0]?.photoIds, ["p1"]);
  });

  it("DN-ITIN-09 remapItinerarySegmentPhotoIds rewires old ids after clone remint", () => {
    const days = parseDenaliItineraryDays([
      {
        dayNumber: 1,
        title: "Day one",
        segments: [{ id: "s1", kind: "activity", title: "Hike", photoIds: ["old"] }],
      },
    ]);
    const remapped = remapItinerarySegmentPhotoIds(days, new Map([["old", "new"]]));
    assert.deepEqual(remapped[0]?.segments[0]?.photoIds, ["new"]);
  });
});
