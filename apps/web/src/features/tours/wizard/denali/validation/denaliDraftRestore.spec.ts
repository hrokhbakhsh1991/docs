import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { applyDenaliInvariantState } from "./denaliInvariantEngine";

test("draft restore: mountain_day draft with event ghost fields", () => {
  // 1. Simulate a "dirty" draft from storage (e.g. from an old version or manual manipulation)
  const rawDraft = buildDenaliTourCreateDefaultValues();
  rawDraft.basicInfo.tourType = "mountain_day";
  
  // These should be hidden/cleared for mountain_day
  (rawDraft as any).basicInfo.endDateTime = "2026-06-03T18:00:00.000Z"; 

  // 2. Restore Draft (Gate)
  const restored = applyDenaliInvariantState(rawDraft);

  // 3. Assert Cleanup
  assert.equal(restored.basicInfo.endDateTime, undefined, "ghost fields should be cleared upon restore");
  assert.equal(restored.basicInfo.tourType, "mountain_day");
});

test("draft restore: kind switch restoration (mountain -> event)", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "event_reading";
  form.programNature.difficultyLevel = 8; // Ghost field for event
  
  const restored = applyDenaliInvariantState(form);
  
  assert.equal(restored.basicInfo.tourType, "event_reading");
  assert.equal(restored.programNature.difficultyLevel, undefined, "outdoor fields must be cleared for event");
});
