import assert from "node:assert/strict";
import test from "node:test";

import { canonicalZodPathToFormFieldPath } from "./denaliCanonicalIssuePaths";

test("canonicalZodPathToFormFieldPath maps 5-zone nested coordinates", () => {
  assert.equal(
    canonicalZodPathToFormFieldPath(["gatheringPoint", "latitude"]),
    "basicInfo.gatheringPoint.latitude",
  );
  assert.equal(
    canonicalZodPathToFormFieldPath(["summitPoint", "longitude"]),
    "basicInfo.summitPoint.longitude",
  );
  assert.equal(
    canonicalZodPathToFormFieldPath(["endPoint", "addressText"]),
    "basicInfo.endPoint.addressText",
  );
});

test("canonicalZodPathToFormFieldPath maps itinerary day photos", () => {
  assert.equal(
    canonicalZodPathToFormFieldPath(["program", "itinerary", 2, "photos"]),
    "programNature.itinerary.2.photos",
  );
});

test("canonicalZodPathToFormFieldPath maps participants.gearItems id issues", () => {
  assert.equal(
    canonicalZodPathToFormFieldPath(["participants", "gearItems", 0, "id"]),
    "participantRequirements.gearItems.0.id",
  );
});
