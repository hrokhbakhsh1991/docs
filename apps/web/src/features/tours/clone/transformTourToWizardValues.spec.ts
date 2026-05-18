import test from "node:test";
import assert from "node:assert/strict";

import { defaultTourFormProfileForTourType } from "@repo/types";

import {
  transformTourToWizardValues,
  type TourCloneSourceDto,
} from "./transformTourToWizardValues";

const THEME_A = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const THEME_B = "b1eebc99-9c0b-4ef9-bb6d-6bb9bd380a11";
const THEME_C = "c2eebc99-9c0b-4efa-bb6d-6bb9bd380a11";
const REGION_R = "a1111111-1111-4111-8111-111111111111";
const DEST_MAIN = "a2222222-2222-4222-8222-222222222222";
const DEST_TRIP = "a3333333-3333-4333-8333-333333333333";
const DEST_SEC_1 = "a4444444-4444-4444-8444-444444444444";
const DEST_SEC_2 = "a5555555-5555-4555-8555-555555555555";

function makeApiTour(overrides: Partial<TourCloneSourceDto> = {}): TourCloneSourceDto {
  return {
    title: "Test tour",
    description: "long form",
    tourType: "mountain",
    chatLink: null,
    autoAcceptRegistrations: true,
    destinationId: null,
    transportModes: [],
    costContext: null,
    details: {
      tripDetails: {
        overview: {},
        itinerary: {},
        logistics: {},
        participation: {},
        policies: {},
      } as Record<string, unknown>,
    },
    ...overrides,
  };
}

function setTripDetails(
  base: TourCloneSourceDto,
  patch: { overview?: object; itinerary?: object; logistics?: object; participation?: object; policies?: object },
): TourCloneSourceDto {
  const tripDetails = (base.details?.tripDetails ?? {}) as Record<string, unknown>;
  return {
    ...base,
    details: {
      tripDetails: {
        ...tripDetails,
        overview: { ...((tripDetails.overview as object) ?? {}), ...patch.overview },
        itinerary: { ...((tripDetails.itinerary as object) ?? {}), ...patch.itinerary },
        logistics: { ...((tripDetails.logistics as object) ?? {}), ...patch.logistics },
        participation: { ...((tripDetails.participation as object) ?? {}), ...patch.participation },
        policies: { ...((tripDetails.policies as object) ?? {}), ...patch.policies },
      },
    },
  };
}

/* ---------- Themes (T1–T5) ---------- */

test("T1 themes_canonical_order: main = tourThemeIds[0], secondary = rest", () => {
  const api = setTripDetails(makeApiTour(), {
    overview: { tourThemeIds: [THEME_A, THEME_B, THEME_C] },
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.overview?.mainTourThemeId, THEME_A);
  assert.deepEqual(wf.overview?.secondaryTourThemeIds, [THEME_B, THEME_C]);
});

test("T2 themes_empty_array: no themes → main='' and secondary=[]", () => {
  const api = setTripDetails(makeApiTour(), { overview: { tourThemeIds: [] } });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.overview?.mainTourThemeId, "");
  assert.deepEqual(wf.overview?.secondaryTourThemeIds, []);
});

test("T3 themes_only_main: single element → main set, secondary empty", () => {
  const api = setTripDetails(makeApiTour(), { overview: { tourThemeIds: [THEME_A] } });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.overview?.mainTourThemeId, THEME_A);
  assert.deepEqual(wf.overview?.secondaryTourThemeIds, []);
});

test("T4 themes_main_not_repeated_in_secondary: duplicate main filtered out of rest", () => {
  const api = setTripDetails(makeApiTour(), {
    overview: { tourThemeIds: [THEME_A, THEME_B, THEME_A, THEME_C] },
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.overview?.mainTourThemeId, THEME_A);
  assert.deepEqual(wf.overview?.secondaryTourThemeIds, [THEME_B, THEME_C]);
});

test("T5 themes_user_required_AB_with_region_R: tourThemeIds=[A,B] + settingsRegionId=R → main=A, secondary=[B], regionId=R", () => {
  const api = setTripDetails(makeApiTour(), {
    overview: {
      tourThemeIds: [THEME_A, THEME_B],
      settingsRegionId: REGION_R,
    },
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.overview?.mainTourThemeId, THEME_A);
  assert.deepEqual(wf.overview?.secondaryTourThemeIds, [THEME_B]);
  assert.equal(wf.location?.regionId, REGION_R);
});

test("T5b themes_missing_from_workspace_catalog: clone preserves theme IDs verbatim regardless of catalog", () => {
  // Catalog membership is checked in the wrapper, not the transform. The
  // transform must still place the source IDs in main/secondary slots.
  const unknownThemeId = "deadbeef-dead-4dad-8dad-deadbeefdead";
  const api = setTripDetails(
    makeApiTour({ tourType: "city" }),
    { overview: { tourThemeIds: [unknownThemeId, THEME_B] } },
  );
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.overview?.mainTourThemeId, unknownThemeId);
  assert.deepEqual(wf.overview?.secondaryTourThemeIds, [THEME_B]);
  // tourType is preserved so the wrapper's fallback chain (defaultTourFormProfileForTourType)
  // can still resolve a profile equivalent to the pre-refactor behaviour.
  assert.equal(wf.overview?.tourType, "city");
  // Sanity check: the fallback helper used by the wrapper maps "city" → "urban_event".
  assert.equal(defaultTourFormProfileForTourType("city"), "urban_event");
});

/* ---------- Location (L1–L7) ---------- */

test("L1 region_from_settings_region_id", () => {
  const api = setTripDetails(makeApiTour(), { overview: { settingsRegionId: REGION_R } });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.location?.regionId, REGION_R);
});

test("L2 region_missing_returns_empty_string", () => {
  const wf = transformTourToWizardValues(makeApiTour());
  assert.equal(wf.location?.regionId, "");
});

test("L3 main_destination_priority_root_over_trip_details", () => {
  const api = setTripDetails(
    makeApiTour({ destinationId: DEST_MAIN }),
    { overview: { settingsMainDestinationId: DEST_TRIP } },
  );
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.location?.mainDestinationId, DEST_MAIN);
});

test("L4 main_destination_fallback_to_trip_details", () => {
  const api = setTripDetails(
    makeApiTour({ destinationId: null }),
    { overview: { settingsMainDestinationId: DEST_TRIP } },
  );
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.location?.mainDestinationId, DEST_TRIP);
});

test("L5 secondary_destinations_csv_parsed_and_uuid_filtered", () => {
  const api = setTripDetails(makeApiTour(), {
    overview: {
      secondaryDestinationIdsRaw: `${DEST_SEC_1}, ${DEST_SEC_2} , not-a-uuid, ${DEST_MAIN}`,
    },
  });
  const wf = transformTourToWizardValues(api);
  assert.deepEqual(wf.location?.secondaryDestinationIds, [DEST_SEC_1, DEST_SEC_2, DEST_MAIN]);
});

test("L6 meeting_point_from_logistics", () => {
  const api = setTripDetails(makeApiTour(), { logistics: { meetingPoint: "Azadi Square" } });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.location?.meetingPoint, "Azadi Square");
});

test("L7 display_location_not_read_from_trip_details", () => {
  // `displayLocation` is wizard-only / write-only; canonical API never echoes it.
  const api = setTripDetails(makeApiTour(), {
    overview: { displayLocation: "ghost-payload-must-be-ignored" } as unknown as Record<string, unknown>,
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.location?.displayLocation, "");
});

/* ---------- Itinerary (I1–I6) ---------- */

test("I1 days_carry_from_segment_activities", () => {
  const api = setTripDetails(makeApiTour(), {
    itinerary: {
      segmentActivities: [
        {
          dayNumber: 1,
          title: "Approach",
          description: "Transfer to base camp",
          segments: [
            {
              title: "Hike to camp",
              description: "",
              activityType: "hike",
              distanceKm: 8,
              elevationGainMeters: 450,
              maxAltitudeMeters: 4200,
              startTime: "06:00",
              endTime: "12:30",
              locationName: "Gate 3",
            },
          ],
        },
      ],
    },
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.itinerary?.days.length, 1);
  const day = wf.itinerary!.days[0]!;
  assert.equal(day.dayNumber, 1);
  assert.equal(day.title, "Approach");
  assert.equal(day.segments.length, 1);
  const seg = day.segments[0]!;
  assert.equal(seg.activityType, "hike");
  assert.equal(seg.distanceKm, 8);
  assert.equal(seg.elevationGainMeters, 450);
  assert.equal(seg.maxAltitudeMeters, 4200);
  assert.equal(seg.startTime, "06:00");
  assert.equal(seg.endTime, "12:30");
  assert.equal(seg.locationName, "Gate 3");
});

test("I2 days_missing_returns_empty_array", () => {
  const wf = transformTourToWizardValues(makeApiTour());
  assert.deepEqual(wf.itinerary?.days, []);
});

test("I3 legacy_day_plans_alone_ignored_for_segment_days", () => {
  const api = setTripDetails(makeApiTour(), {
    itinerary: {
      dayPlans: [{ day: 1, title: "legacy", description: "" }],
    },
  });
  const wf = transformTourToWizardValues(api);
  assert.deepEqual(wf.itinerary?.days, []);
});

test("I4 highlights_from_itinerary_not_overview", () => {
  const api = setTripDetails(makeApiTour(), {
    itinerary: { highlights: ["Peak", "Sunrise"] },
    overview: { highlights: ["ghost-from-overview"] } as unknown as Record<string, unknown>,
  });
  const wf = transformTourToWizardValues(api);
  assert.deepEqual(wf.overview?.highlights, ["Peak", "Sunrise"]);
});

test("I5 invalid_day_number_dropped", () => {
  const api = setTripDetails(makeApiTour(), {
    itinerary: {
      segmentActivities: [
        { dayNumber: 0, title: "bad", segments: [] },
        { dayNumber: 1.5, title: "bad", segments: [] },
        { dayNumber: 2, title: "good", segments: [] },
        { title: "no-day-number", segments: [] },
      ],
    },
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.itinerary?.days.length, 1);
  assert.equal(wf.itinerary?.days[0]?.dayNumber, 2);
  assert.equal(wf.itinerary?.days[0]?.title, "good");
});

/* ---------- Logistics / Schedule (Lg1–Lg7) ---------- */

test("Lg1 primary_transport_mode_carry", () => {
  const api = setTripDetails(makeApiTour(), { logistics: { primaryTransportMode: "bus" } });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.logistics?.primaryTransportMode, "bus");
});

test("Lg2 supplemental_private_car_inferred", () => {
  const api = setTripDetails(
    makeApiTour({ transportModes: ["bus", "private_car"] }),
    { logistics: { primaryTransportMode: "bus" } },
  );
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.logistics?.supplementalPrivateCar, true);
});

test("Lg2b supplemental_private_car_false_when_primary_is_private_car", () => {
  const api = setTripDetails(
    makeApiTour({ transportModes: ["private_car"] }),
    { logistics: { primaryTransportMode: "private_car" } },
  );
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.logistics?.supplementalPrivateCar, false);
});

test("Lg3 fuel_share_carry", () => {
  const api = setTripDetails(makeApiTour(), {
    logistics: { primaryTransportMode: "private_car", fuelShareToman: 300_000 },
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.logistics?.fuelShareToman, 300_000);
});

test("Lg4 transportation_notes_only_canonical_key", () => {
  const api = setTripDetails(makeApiTour(), {
    logistics: {
      transportationNotes: "Pickup at Azadi 05:30",
      transportationDetails: "ghost-key-must-be-ignored",
    } as unknown as Record<string, unknown>,
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.logistics?.transportationNotes, "Pickup at Azadi 05:30");
  assert.equal(wf.logistics?.transportationDetails, "");
});

test("Lg5 included_services_array_to_multiline", () => {
  const api = setTripDetails(makeApiTour(), {
    logistics: {
      includedServices: ["Bus", "Guide", "Insurance"],
      excludedServices: ["Meals"],
    } as unknown as Record<string, unknown>,
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.logistics?.includedServices, "Bus\nGuide\nInsurance");
  assert.equal(wf.logistics?.excludedServices, "Meals");
});

test("Lg5b included_services_string_passthrough", () => {
  // Legacy / pass-through: a server that already sends a multi-line string keeps that shape.
  const api = setTripDetails(makeApiTour(), {
    logistics: { includedServices: "Bus\nGuide" } as unknown as Record<string, unknown>,
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.logistics?.includedServices, "Bus\nGuide");
});

test("Lg6 meeting_times_intentionally_empty_on_clone (TODO: see prompt.md §2.6)", () => {
  // Even though the API may carry these, current product decision is to clear them on clone.
  const api = setTripDetails(makeApiTour(), {
    logistics: { departureMeetingTime: "05:30", returnMeetingTime: "22:00" },
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.schedule?.departureMeetingTime, "");
  assert.equal(wf.schedule?.returnMeetingTime, "");
});

test("Lg7 dates_always_empty_on_clone", () => {
  const api = setTripDetails(makeApiTour(), {
    logistics: { departureDate: "2026-05-01", returnDate: "2026-05-03" },
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.schedule?.startDate, "");
  assert.equal(wf.schedule?.endDate, "");
});

/* ---------- Pricing (P1–P3) ---------- */

test("P1 price_from_cost_context_total_cost", () => {
  const api = makeApiTour({ costContext: { currency: "IRR", totalCost: 1_500_000 } });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.pricing?.basePrice, 1_500_000);
});

test("requiresPayment round-trips from costContext", () => {
  const api = makeApiTour({
    costContext: { currency: "IRR", totalCost: 900_000, requiresPayment: true },
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.pricing?.requiresPayment, true);
});

test("P2 price_no_cost_context_zero", () => {
  const wf = transformTourToWizardValues(makeApiTour({ costContext: null }));
  assert.equal(wf.pricing?.basePrice, 0);
});

test("P3 price_legacy_base_price_toman_key_not_read", () => {
  // Regression: the previous reader was looking at costContext.basePriceToman which is not a
  // canonical key. Confirm new reader returns 0 (it does not pick up the phantom key).
  const api = makeApiTour({ costContext: { basePriceToman: 800_000 } });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.pricing?.basePrice, 0);
});

/* ---------- Policies (Po1–Po2) ---------- */

test("Po1 safety_policy_canonical_only", () => {
  const api = setTripDetails(makeApiTour(), {
    policies: {
      safetyPolicy: "Be careful",
      safetyNotes: "ghost-key-must-be-ignored",
    } as unknown as Record<string, unknown>,
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.policies?.safetyPolicy, "Be careful");
  assert.equal(wf.policies?.safetyNotes, "");
});

test("Po2 reservation_rules_canonical_only", () => {
  const api = setTripDetails(makeApiTour(), {
    policies: {
      reservationRules: "Rules apply",
      riskDisclaimer: "ghost-key-must-be-ignored",
    } as unknown as Record<string, unknown>,
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.policies?.reservationRules, "Rules apply");
  assert.equal(wf.policies?.riskDisclaimer, "");
});

/* ---------- Participation passthrough ---------- */

test("Pa1 participation_canonical_passthrough", () => {
  const gearId = "ee111111-1111-4111-8111-111111111111";
  const api = setTripDetails(makeApiTour(), {
    participation: {
      experienceLevel: "intermediate",
      fitnessLevel: "moderate",
      minimumAge: 18,
      maximumAge: 60,
      genderRestriction: "none",
      technicalSkillRequired: "Basic rope work",
      medicalRestrictions: "",
      requirements: "Strong cardio",
      gearRequiredIds: [gearId],
      sportsInsuranceRequired: true,
      registrationNationalIdRequired: true,
    },
  });
  const wf = transformTourToWizardValues(api);
  assert.equal(wf.participation?.requiredExperienceLevel, "intermediate");
  assert.equal(wf.participation?.requiredFitnessLevel, "moderate");
  assert.equal(wf.participation?.minimumAge, 18);
  assert.equal(wf.participation?.maximumAge, 60);
  assert.equal(wf.participation?.technicalSkillRequired, "Basic rope work");
  assert.equal(wf.participation?.requirements, "Strong cardio");
  assert.deepEqual(wf.participation?.gearRequiredIds, [gearId]);
  assert.equal(wf.participation?.sportsInsuranceRequired, true);
  assert.equal(wf.participation?.registrationNationalIdRequired, true);
});

/* ---------- Defensive parsing ---------- */

test("D1 missing_trip_details_returns_safe_defaults", () => {
  const wf = transformTourToWizardValues({
    title: "Bare tour",
    description: null,
    tourType: null,
    autoAcceptRegistrations: null,
    destinationId: null,
    transportModes: undefined,
    costContext: null,
    details: null,
  });
  assert.equal(wf.overview?.title, "Bare tour");
  assert.equal(wf.overview?.mainTourThemeId, "");
  assert.deepEqual(wf.overview?.secondaryTourThemeIds, []);
  assert.equal(wf.location?.regionId, "");
  assert.deepEqual(wf.itinerary?.days, []);
  assert.equal(wf.pricing?.basePrice, 0);
});

test("D2 communication_link_falls_back_to_chat_link", () => {
  const wf = transformTourToWizardValues(makeApiTour({ chatLink: "https://t.me/x", communicationLink: null }));
  assert.equal(wf.overview?.communicationLink, "https://t.me/x");
});

test("D3 communication_link_prefers_canonical_communication_link", () => {
  const wf = transformTourToWizardValues(
    makeApiTour({ chatLink: "https://t.me/legacy", communicationLink: "https://t.me/canonical" }),
  );
  assert.equal(wf.overview?.communicationLink, "https://t.me/canonical");
});
