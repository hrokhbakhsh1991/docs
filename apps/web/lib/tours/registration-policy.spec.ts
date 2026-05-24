import assert from "node:assert/strict";
import test from "node:test";

import { mergeRegistrationPolicyIntoTour } from "./registration-policy";

test("mergeRegistrationPolicyIntoTour sets registrationPolicy on tour record", () => {
  const tour: Record<string, unknown> = {
    transportModes: ["train"],
    details: { tripDetails: { logistics: { primaryTransportMode: "train" } } },
  };
  mergeRegistrationPolicyIntoTour(tour);
  assert.deepEqual(tour.registrationPolicy, { allowPrivateCar: false });
});

test("mergeRegistrationPolicyIntoTour allowPrivateCar true when private_car mode", () => {
  const tour: Record<string, unknown> = {
    transportModes: ["private_car"],
  };
  mergeRegistrationPolicyIntoTour(tour);
  assert.deepEqual(tour.registrationPolicy, { allowPrivateCar: true });
});
