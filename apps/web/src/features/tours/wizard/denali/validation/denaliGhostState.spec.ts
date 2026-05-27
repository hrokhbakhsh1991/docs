import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { safeDenaliFormToCanonical } from "../denaliCanonicalFormAdapter";
import { purgeGhostFields } from "../DenaliWizardSyncContext";
import { denaliRuleSet } from "../rules/denaliRuleModel";
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

  // 3. Switch back to Mountain (hidden outdoor fields re-seed to product defaults)
  safe.basicInfo.tourType = "mountain_day";
  safe = applyDenaliInvariantState(safe);

  assert.equal(safe.programNature.difficultyLevel, 5, "difficulty defaults to 5 when outdoor field becomes visible");
  assert.equal(safe.programNature.hikingHoursApprox, undefined, "hiking hours stay unset until user enters a value");
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

test("ghost state: purgeGhostFields removes previous-kind canonical keys after kind switch", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.programNature.difficultyLevel = 8;
  form.programNature.hikingHoursApprox = 10;
  form.participantRequirements.minimumAge = 21;

  const canonicalBefore = safeDenaliFormToCanonical(form);
  assert.equal(canonicalBefore.program.difficultyLevel, 8);
  assert.equal(canonicalBefore.program.hikingHoursApprox, 10);
  assert.equal(canonicalBefore.participants.minimumAge, 21);

  const canonicalAfter = purgeGhostFields(canonicalBefore, {
    newKind: "event_reading",
    existingForm: form,
    ruleSet: denaliRuleSet,
  });

  assert.equal(
    canonicalAfter.program.difficultyLevel,
    undefined,
    "difficulty must be purged from canonical model on event switch",
  );
  assert.equal(
    canonicalAfter.program.hikingHoursApprox,
    undefined,
    "hiking hours must be purged from canonical model on event switch",
  );
  assert.equal(
    canonicalAfter.participants.minimumAge,
    undefined,
    "minimum age must be purged from canonical model on event switch",
  );
});
