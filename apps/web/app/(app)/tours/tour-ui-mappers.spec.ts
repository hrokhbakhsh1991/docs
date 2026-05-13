import assert from "node:assert/strict";
import test from "node:test";

import type { TourFormValues } from "@/components/tours/tour-schema";
import { normalizeTripDetailsFormDefault } from "@/features/tours/models/tourTripDetails.schema";
import type { TourDetailDto } from "@/lib/services/tours.service";

import { updateTourDtoFromTourFormValues } from "./tour-ui-mappers";

const baseValues: TourFormValues = {
  title: "Test tour title long enough",
  description: "",
  totalCapacity: 10,
  price: 99,
  status: "draft",
  communicationLink: undefined,
  tourType: undefined,
  destinationId: null,
  locationSection: {
    regionId: "",
    mainDestinationId: "",
    secondaryDestinationIdsRaw: "",
    displayLocationOverride: undefined,
  },
  tripDetails: normalizeTripDetailsFormDefault(undefined),
};

const minimalExisting = {
  costContext: null,
} as unknown as TourDetailDto;

test("updateTourDtoFromTourFormValues sets formProfile when resolvedFormProfile is provided", () => {
  const dto = updateTourDtoFromTourFormValues(
    baseValues,
    minimalExisting,
    [{ id: "t1", name: "Theme", formProfile: "urban_event" }],
    "urban_event",
  );
  assert.equal(dto.formProfile, "urban_event");
});

test("updateTourDtoFromTourFormValues omits formProfile when resolvedFormProfile is undefined", () => {
  const dto = updateTourDtoFromTourFormValues(baseValues, minimalExisting);
  assert.equal(dto.formProfile, undefined);
});
