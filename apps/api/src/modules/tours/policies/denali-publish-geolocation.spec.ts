import assert from "node:assert/strict";
import test from "node:test";

import { checkDenaliPilotPublishGeolocationZones } from "@repo/shared-contracts";
import type { TourTripDetails as TypesTourTripDetails } from "@repo/types";
import type { TourTripDetails } from "../types/tour-trip-details.types";

function validGeoZone() {
  return {
    addressText: "Tehran gathering point",
    latitude: 35.6892,
    longitude: 51.389,
  };
}

function denaliTripDetails(
  overview: Record<string, unknown> = {},
): TourTripDetails {
  return {
    overview: {
      denaliTourKind: "mountain_day",
      gatheringPoint: validGeoZone(),
      startPoint: validGeoZone(),
      ...overview,
    },
    logistics: { primaryTransportMode: "bus", groupSizeMax: 12 },
    participation: {
      minimumAge: 18,
      fitnessLevel: "moderate",
      sportsInsuranceRequired: true,
    },
  } as TourTripDetails;
}

function asTypesTripDetails(td: TourTripDetails): TypesTourTripDetails {
  return td as TypesTourTripDetails;
}

test("checkDenaliPilotPublishGeolocationZones accepts concrete gathering and start pins", () => {
  assert.equal(checkDenaliPilotPublishGeolocationZones(asTypesTripDetails(denaliTripDetails())), null);
});

test("checkDenaliPilotPublishGeolocationZones rejects missing zones", () => {
  const violation = checkDenaliPilotPublishGeolocationZones(
    asTypesTripDetails(
      denaliTripDetails({ gatheringPoint: undefined, startPoint: undefined }),
    ),
  );
  assert.ok(violation);
  assert.equal(violation.code, "DENALI_PUBLISH_REQUIRES_GEOLOCATION_ZONES");
  assert.match(violation.message, /gatheringPoint/);
});

test("checkDenaliPilotPublishGeolocationZones rejects text-only pins", () => {
  const violation = checkDenaliPilotPublishGeolocationZones(
    asTypesTripDetails(denaliTripDetails({
      gatheringPoint: { addressText: "Text only", latitude: null, longitude: null },
      startPoint: validGeoZone(),
    })),
  );
  assert.ok(violation);
  assert.equal(violation.code, "DENALI_PUBLISH_REQUIRES_GEOLOCATION_ZONES");
});

test("checkDenaliPilotPublishGeolocationZones rejects latitude without longitude", () => {
  const violation = checkDenaliPilotPublishGeolocationZones(
    asTypesTripDetails(denaliTripDetails({
      gatheringPoint: validGeoZone(),
      startPoint: { addressText: "Start", latitude: 35.7, longitude: null },
    })),
  );
  assert.ok(violation);
  assert.match(violation.message, /startPoint/);
});
