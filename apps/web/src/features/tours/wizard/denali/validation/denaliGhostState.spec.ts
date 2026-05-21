import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { applyDenaliInvariantState } from "./denaliInvariantEngine";


/**
 * Denali Ghost State Elimination Test (map.md §Phase 5).
 * 
 * Verifies that kind switching (e.g. mountain -> event) correctly
 * purges hidden fields and that switching back doesn't restore stale data.
 */


test("ghost state: mountain -> event -> mountain sequence", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.programNature.difficultyLevel = 8;
  form.programNature.hikingHoursApprox = 10;
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = 50000;

  // 1. Initial Mountain State
  let safe = applyDenaliInvariantState(form);
  assert.equal(safe.programNature.difficultyLevel, 8);

  assert.equal(safe.transport.dongAmount, 50000);

  // 2. Switch to Event (Outdoor fields should be cleared)
  safe.basicInfo.tourType = "event_reading";
  safe = applyDenaliInvariantState(safe);
  
  assert.equal(safe.programNature.difficultyLevel, undefined, "difficulty should be cleared on event");
  assert.equal(safe.programNature.hikingHoursApprox, undefined, "hiking hours should be cleared on event");
  assert.equal(safe.participantRequirements.minimumAge, undefined, "min age should be cleared on event");

  // 3. Switch back to Mountain (Fields should stay cleared/reset)
  safe.basicInfo.tourType = "mountain_day";
  safe = applyDenaliInvariantState(safe);
  
  // Note: normalization clears hidden fields, but it doesn't "restore" old values.
  // When switching back, difficulty and hiking are now undefined.
  assert.equal(safe.programNature.difficultyLevel, undefined, "difficulty should stay undefined after switch-back");
});

test("ghost state: pricing clears basePricePerPerson when requiresPayment off", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.pricingPayment.requiresPayment = true;
  form.pricingPayment.basePricePerPerson = 100_000;

  let safe = applyDenaliInvariantState(form);
  assert.equal(safe.pricingPayment.basePricePerPerson, 100_000);

  safe.pricingPayment.requiresPayment = false;
  safe = applyDenaliInvariantState(safe);
  assert.equal(
    safe.pricingPayment.basePricePerPerson,
    undefined,
    "per-person price should clear when tour is not paid",
  );
});
