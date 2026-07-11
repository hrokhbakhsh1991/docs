/**
 * Denali itinerary segment pickers — photo + destination selection logic
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DestinationResource } from "../src/features/settings/settings-module-types";
import { buildItinerarySegmentDestinationSelection } from "@app-tour/workspace-denali/host/ui/logic/denali-itinerary-segment-destination-logic";
import {
  DENALI_ITINERARY_PHOTO_DAY_IS_PICKER_HINT_ONLY,
  filterSelectableItineraryPhotos,
  readItineraryPhotoLabel,
  toggleItinerarySegmentPhotoSelection,
} from "@app-tour/workspace-denali/host/ui/logic/denali-itinerary-segment-photo-logic";
import { readDenaliDestinationLabel } from "@app-tour/workspace-denali/host/ui/hooks/use-destination-catalog";

const DESTINATION_CATALOG = new Map<string, DestinationResource>([
  [
    "dest-1",
    {
      id: "dest-1",
      regionId: "region-1",
      name: "Damavand",
      isActive: true,
    },
  ],
  [
    "dest-inactive",
    {
      id: "dest-inactive",
      regionId: "region-1",
      name: "Hidden",
      isActive: false,
    },
  ],
]);

describe("denali-itinerary-segment-pickers.spec.ts", () => {
  it("WEB-DENALI-ITIN-12 filterSelectableItineraryPhotos drops photos without ids", () => {
    const photos = filterSelectableItineraryPhotos([
      { id: "p1", label: "Summit" },
      { label: "No id" },
      { id: "  ", label: "Blank id" },
    ]);
    assert.equal(photos.length, 1);
    assert.equal(photos[0]?.id, "p1");
  });

  it("WEB-DENALI-ITIN-13 filterSelectableItineraryPhotos prioritizes matching day photos", () => {
    const photos = filterSelectableItineraryPhotos(
      [
        { id: "p-other", day: 2 },
        { id: "p-day1", day: 1 },
        { id: "p-none" },
      ],
      1
    );
    assert.deepEqual(
      photos.map((photo) => photo.id),
      ["p-day1", "p-other", "p-none"]
    );
  });

  it("WEB-DENALI-ITIN-14 toggleItinerarySegmentPhotoSelection adds and removes ids", () => {
    assert.deepEqual(toggleItinerarySegmentPhotoSelection([], "p1"), ["p1"]);
    assert.deepEqual(toggleItinerarySegmentPhotoSelection(["p1"], "p1"), []);
    assert.deepEqual(toggleItinerarySegmentPhotoSelection(["p1"], "p2"), ["p1", "p2"]);
  });

  it("WEB-DENALI-ITIN-15 readItineraryPhotoLabel falls back when label missing", () => {
    assert.equal(readItineraryPhotoLabel({ id: "p1", label: "Camp" }, "Photo"), "Camp");
    assert.equal(readItineraryPhotoLabel({ id: "p1" }, "Photo"), "Photo");
  });

  it("WEB-DENALI-ITIN-16 buildItinerarySegmentDestinationSelection resolves locationLabel", () => {
    assert.deepEqual(buildItinerarySegmentDestinationSelection("", DESTINATION_CATALOG), {
      destinationId: undefined,
    });
    assert.deepEqual(
      buildItinerarySegmentDestinationSelection("dest-1", DESTINATION_CATALOG),
      { destinationId: "dest-1", locationLabel: "Damavand" }
    );
    assert.deepEqual(
      buildItinerarySegmentDestinationSelection("dest-missing", DESTINATION_CATALOG),
      { destinationId: "dest-missing", locationLabel: undefined }
    );
  });

  it("WEB-DENALI-ITIN-17 readDenaliDestinationLabel reads active destination names", () => {
    assert.equal(readDenaliDestinationLabel("dest-1", DESTINATION_CATALOG), "Damavand");
    assert.equal(readDenaliDestinationLabel("dest-inactive", DESTINATION_CATALOG), "Hidden");
    assert.equal(readDenaliDestinationLabel(undefined, DESTINATION_CATALOG), undefined);
  });

  it("WEB-DENALI-ITIN-20 photo day tag is picker hint only and keeps untagged photos selectable", () => {
    assert.equal(DENALI_ITINERARY_PHOTO_DAY_IS_PICKER_HINT_ONLY, true);
    const photos = filterSelectableItineraryPhotos(
      [
        { id: "p-untyped" },
        { id: "p-day2", day: 2 },
        { id: "p-day1", day: 1 },
      ],
      1
    );
    assert.deepEqual(
      photos.map((photo) => photo.id),
      ["p-day1", "p-untyped", "p-day2"]
    );
  });
});
