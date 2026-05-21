import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveDenaliDifficultyType,
  deriveDenaliIsMultiDay,
  selectDenaliWizardDerived,
} from "./denaliWizardDerived";
import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

test("deriveDenaliIsMultiDay follows tour kind slug", () => {
  assert.equal(deriveDenaliIsMultiDay("mountain_day"), false);
  assert.equal(deriveDenaliIsMultiDay("nature_multi"), true);
  assert.equal(deriveDenaliIsMultiDay(undefined), false);
});

test("deriveDenaliDifficultyType is none for events, physical otherwise", () => {
  assert.equal(deriveDenaliDifficultyType("event_cinema"), "none");
  assert.equal(deriveDenaliDifficultyType("mountain_day"), "physical");
  assert.equal(deriveDenaliDifficultyType(undefined), undefined);
});

test("selectDenaliWizardDerived is a read-only snapshot", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "desert_multi";
  const derived = selectDenaliWizardDerived(form);
  assert.equal(derived.isMultiDay, true);
  assert.equal(derived.difficultyType, "physical");
  assert.equal(derived.isOutdoorTour, true);
  assert.equal(derived.isEventTour, false);
});
