import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import {
  buildDenaliDefaultGatheringPoints,
  buildEmptyDenaliGatheringPointRow,
  denaliGatheringPointHasContent,
} from "./denaliDefaultGatheringPoints";
import { hasRecoverableDenaliFormPatch } from "./denaliDraftRecovery";

test("buildDenaliDefaultGatheringPoints: seeds two empty rows with stable ids", () => {
  const rows = buildDenaliDefaultGatheringPoints();
  assert.equal(rows.length, 2);
  assert.ok(rows[0]?.id);
  assert.ok(rows[1]?.id);
  assert.notEqual(rows[0]?.id, rows[1]?.id);
  assert.equal(denaliGatheringPointHasContent(rows[0]), false);
  assert.equal(denaliGatheringPointHasContent(rows[1]), false);
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

test("buildDenaliTourCreateDefaultValues includes two default gathering rows", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  assert.equal(defaults.tripDetails.logistics.gatheringPoints.length, 2);
  assert.equal(hasRecoverableDenaliFormPatch(defaults), false);
});

test("hasRecoverableDenaliFormPatch: filled gathering station makes draft recoverable", () => {
  const patch = buildDenaliTourCreateDefaultValues();
  patch.tripDetails.logistics.gatheringPoints[0] = {
    ...patch.tripDetails.logistics.gatheringPoints[0]!,
    title: "میدان رسالت",
    time: "02:30",
  };
  assert.equal(hasRecoverableDenaliFormPatch(patch), true);
});
