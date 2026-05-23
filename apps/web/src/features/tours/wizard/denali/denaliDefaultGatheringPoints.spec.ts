import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import {
  buildDenaliDefaultGatheringPoints,
  buildEmptyDenaliGatheringPointRow,
  denaliGatheringPointHasContent,
} from "./denaliDefaultGatheringPoints";

test("buildDenaliDefaultGatheringPoints: seeds one empty row with stable id", () => {
  const rows = buildDenaliDefaultGatheringPoints();
  assert.equal(rows.length, 1);
  assert.ok(rows[0]?.id);
  assert.equal(denaliGatheringPointHasContent(rows[0]), false);
});

test("denaliGatheringPointHasContent: detects title, time, or coordinates", () => {
  const empty = buildEmptyDenaliGatheringPointRow("row-1");
  assert.equal(denaliGatheringPointHasContent(empty), false);

  assert.equal(denaliGatheringPointHasContent({ ...empty, title: "میدان رسالت" }), true);
  assert.equal(denaliGatheringPointHasContent({ ...empty, time: "02:30" }), true);
  assert.equal(
    denaliGatheringPointHasContent({
      ...empty,
      location: { addressText: "آزادی", latitude: 35.7, longitude: 51.3 },
    }),
    true,
  );
});

test("buildDenaliTourCreateDefaultValues includes empty gathering points array", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  assert.equal(defaults.tripDetails.logistics.gatheringPoints.length, 0);
});

test("denaliGatheringPointHasContent: filled gathering station is detected", () => {
  const row = buildEmptyDenaliGatheringPointRow("row-1");
  assert.equal(
    denaliGatheringPointHasContent({
      ...row,
      title: "میدان رسالت",
      time: "02:30",
      location: { addressText: "", latitude: null, longitude: null },
    }),
    true,
  );
});
