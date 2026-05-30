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

function validGatheringStation() {
  return {
    title: "میدان رسالت",
    time: "06:30",
    location: validGeoZone(),
  };
}

function denaliTripDetails(
  overview: Record<string, unknown> = {},
  logistics: Record<string, unknown> = {},
): TourTripDetails {
  return {
    overview: {
      denaliTourKind: "mountain_day",
      startPoint: validGeoZone(),
      ...overview,
    },
    logistics: {
      primaryTransportMode: "bus",
      groupSizeMax: 12,
      gatheringPoints: [validGatheringStation()],
      ...logistics,
    },
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
      denaliTripDetails({ startPoint: undefined }, { gatheringPoints: [] }),
    ),
  );
  assert.ok(violation);
  assert.equal(violation.code, "DENALI_PUBLISH_REQUIRES_GEOLOCATION_ZONES");
  assert.match(violation.message, /gatheringPoints/);
});

test("checkDenaliPilotPublishGeolocationZones skips geo for event tour kinds", () => {
  for (const denaliTourKind of ["event_reading", "event_cinema"] as const) {
    const violation = checkDenaliPilotPublishGeolocationZones(
      asTypesTripDetails(
        denaliTripDetails(
          { denaliTourKind, startPoint: undefined },
          { gatheringPoints: [] },
        ),
      ),
    );
    assert.equal(violation, null, denaliTourKind);
  }
});

test("checkDenaliPilotPublishGeolocationZones rejects text-only pins", () => {
  const violation = checkDenaliPilotPublishGeolocationZones(
    asTypesTripDetails(denaliTripDetails(
      { startPoint: validGeoZone() },
      {
        gatheringPoints: [
          { title: "بدون مختصات", location: { addressText: "Text only", latitude: null, longitude: null } },
        ],
      }
    )),
  );
  assert.ok(violation);
  assert.equal(violation.code, "DENALI_PUBLISH_REQUIRES_GEOLOCATION_ZONES");
});

test("checkDenaliPilotPublishGeolocationZones rejects latitude without longitude", () => {
  const violation = checkDenaliPilotPublishGeolocationZones(
    asTypesTripDetails(denaliTripDetails(
      { startPoint: { addressText: "Start", latitude: 35.7, longitude: null } },
      { gatheringPoints: [validGatheringStation()] }
    )),
  );
  assert.ok(violation);
  assert.match(violation.message, /startPoint/);
});
