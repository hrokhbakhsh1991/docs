import assert from "node:assert/strict";
import test from "node:test";

import {
  getTourCreateWizardValidationFlags,
  mergeTourValidationFlagsForSchema,
  resetTourCreateWizardValidationFlags,
  resetTourFlatFormProfileValidationFlags,
  setTourCreateWizardValidationFlags,
  setTourFlatFormProfileValidationFlags,
  tourFormProfileToWizardValidationFlags,
} from "./tourCreateValidationPolicy";

test("tourFormProfileToWizardValidationFlags: general is strict", () => {
  assert.deepEqual(tourFormProfileToWizardValidationFlags("general"), {
    relaxItineraryMinDays: false,
    relaxLogisticsPrimary: false,
  });
});

test("tourFormProfileToWizardValidationFlags: cinema relaxes itinerary only", () => {
  assert.deepEqual(tourFormProfileToWizardValidationFlags("cinema_event"), {
    relaxItineraryMinDays: true,
    relaxLogisticsPrimary: false,
  });
});

test("tourFormProfileToWizardValidationFlags: urban relaxes itinerary and logistics primary", () => {
  assert.deepEqual(tourFormProfileToWizardValidationFlags("urban_event"), {
    relaxItineraryMinDays: true,
    relaxLogisticsPrimary: true,
  });
});

test("tourFormProfileToWizardValidationFlags: mountain_outdoor / cultural_tour / nature_trip stay strict", () => {
  const strict = { relaxItineraryMinDays: false, relaxLogisticsPrimary: false };
  assert.deepEqual(tourFormProfileToWizardValidationFlags("mountain_outdoor"), strict);
  assert.deepEqual(tourFormProfileToWizardValidationFlags("cultural_tour"), strict);
  assert.deepEqual(tourFormProfileToWizardValidationFlags("nature_trip"), strict);
});

test("setTourCreateWizardValidationFlags merges with tourFormProfileToWizardValidationFlags", () => {
  resetTourCreateWizardValidationFlags();
  setTourCreateWizardValidationFlags(tourFormProfileToWizardValidationFlags("urban_event"));
  assert.deepEqual(getTourCreateWizardValidationFlags(), {
    relaxItineraryMinDays: true,
    relaxLogisticsPrimary: true,
  });
  resetTourCreateWizardValidationFlags();
});

test("mergeTourValidationFlagsForSchema ORs wizard and flat form flags", () => {
  resetTourCreateWizardValidationFlags();
  resetTourFlatFormProfileValidationFlags();
  setTourCreateWizardValidationFlags({ relaxItineraryMinDays: false, relaxLogisticsPrimary: false });
  setTourFlatFormProfileValidationFlags(tourFormProfileToWizardValidationFlags("urban_event"));
  assert.deepEqual(mergeTourValidationFlagsForSchema(), {
    relaxItineraryMinDays: true,
    relaxLogisticsPrimary: true,
  });
  resetTourCreateWizardValidationFlags();
  resetTourFlatFormProfileValidationFlags();
});
