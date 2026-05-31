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
    requiresMountainTransportEconomics: false,
  });
});

test("tourFormProfileToWizardValidationFlags: cinema relaxes itinerary only", () => {
  assert.deepEqual(tourFormProfileToWizardValidationFlags("cinema_event"), {
    relaxItineraryMinDays: true,
    relaxLogisticsPrimary: false,
    requiresMountainTransportEconomics: false,
  });
});

test("tourFormProfileToWizardValidationFlags: urban relaxes itinerary and logistics primary", () => {
  assert.deepEqual(tourFormProfileToWizardValidationFlags("urban_event"), {
    relaxItineraryMinDays: true,
    relaxLogisticsPrimary: true,
    requiresMountainTransportEconomics: false,
  });
});

test("tourFormProfileToWizardValidationFlags: mountain_outdoor requires transport economics", () => {
  assert.deepEqual(tourFormProfileToWizardValidationFlags("mountain_outdoor"), {
    relaxItineraryMinDays: false,
    relaxLogisticsPrimary: false,
    requiresMountainTransportEconomics: true,
  });
});

test("tourFormProfileToWizardValidationFlags: cultural_tour / nature_trip stay strict without economics", () => {
  const strict = {
    relaxItineraryMinDays: false,
    relaxLogisticsPrimary: false,
    requiresMountainTransportEconomics: false,
  };
  assert.deepEqual(tourFormProfileToWizardValidationFlags("cultural_tour"), strict);
  assert.deepEqual(tourFormProfileToWizardValidationFlags("nature_trip"), strict);
});

test("setTourCreateWizardValidationFlags merges with tourFormProfileToWizardValidationFlags", () => {
  resetTourCreateWizardValidationFlags();
  setTourCreateWizardValidationFlags(tourFormProfileToWizardValidationFlags("urban_event"));
  assert.deepEqual(getTourCreateWizardValidationFlags(), {
    relaxItineraryMinDays: true,
    relaxLogisticsPrimary: true,
    requiresMountainTransportEconomics: false,
  });
  resetTourCreateWizardValidationFlags();
});

test("mergeTourValidationFlagsForSchema ORs wizard and flat form flags", () => {
  resetTourCreateWizardValidationFlags();
  resetTourFlatFormProfileValidationFlags();
  setTourCreateWizardValidationFlags({
    relaxItineraryMinDays: false,
    relaxLogisticsPrimary: false,
    requiresMountainTransportEconomics: false,
  });
  setTourFlatFormProfileValidationFlags(tourFormProfileToWizardValidationFlags("urban_event"));
  assert.deepEqual(mergeTourValidationFlagsForSchema(), {
    relaxItineraryMinDays: true,
    relaxLogisticsPrimary: true,
    requiresMountainTransportEconomics: false,
  });
  resetTourCreateWizardValidationFlags();
  resetTourFlatFormProfileValidationFlags();
});
