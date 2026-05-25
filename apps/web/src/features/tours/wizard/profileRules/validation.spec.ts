import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VALUES } from "@repo/types";

import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";
import { wizardSteps, type TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";

import {
  requiredFieldsForProfile,
  requiredFieldsForStep,
  validateForAutosave,
  validateForStepNavigation,
  validateForSubmit,
} from "./validation";
import { getVisibleStepIds } from "./getProfileRules";

/**
 * Build an empty-shaped form value that satisfies the TS type but has every required field
 * left blank. Used to assert validators report the expected missing fields.
 */
function emptyFormValues(): TourCreateFormValues {
  return {
    autoAcceptRegistrations: undefined,
    overview: {
      title: "",
      slug: undefined,
      mainTourThemeId: undefined,
      secondaryTourThemeIds: undefined,
      tourType: undefined,
      tripStyles: undefined,
      shortDescription: undefined,
      longDescription: undefined,
      highlights: undefined,
      locationSummary: undefined,
      communicationLink: undefined,
    },
    pricing: {
      basePrice: Number.NaN,
      currency: undefined,
      discountNotes: undefined,
    },
    schedule: {
      startDate: undefined,
      endDate: undefined,
      departureMeetingTime: undefined,
      returnMeetingTime: undefined,
    },
    location: {
      regionId: undefined,
      mainDestinationId: undefined,
      secondaryDestinationIds: undefined,
      meetingPoint: undefined,
      returnPoint: undefined,
      displayLocation: undefined,
    },
    itinerary: {
      days: [],
    },
    participation: {
      requiredExperienceLevel: undefined,
      requiredFitnessLevel: undefined,
      minParticipants: undefined,
      minimumAge: undefined,
      maximumAge: undefined,
      genderRestriction: undefined,
      technicalSkillRequired: undefined,
      medicalRestrictions: undefined,
      requirements: undefined,
      skillsRequired: undefined,
      gearRequiredIds: undefined,
      gearOptionalIds: undefined,
      documentsRequired: undefined,
      suitableFor: undefined,
      notSuitableFor: undefined,
      sportsInsuranceRequired: undefined,
      registrationNationalIdRequired: undefined,
    },
    logistics: {
      primaryTransportMode: undefined,
      supplementalPrivateCar: undefined,
      fuelShareToman: undefined,
      includedServices: undefined,
      excludedServices: undefined,
      meetingPointDetails: undefined,
      transportationDetails: undefined,
      accommodationDetails: undefined,
      transportationNotes: undefined,
      accommodationTypes: undefined,
      accommodationNotes: undefined,
      mealPlan: undefined,
      mealNotes: undefined,
      supportServices: undefined,
      optionalServices: undefined,
      leaderProvidesInsurance: undefined,
      leaderInsuranceNotes: undefined,
      guideLanguageIds: undefined,
      groupSizeMin: undefined,
      groupSizeMax: undefined,
    },
    policies: {
      cancellationPolicy: undefined,
      refundPolicy: undefined,
      safetyNotes: undefined,
      riskDisclaimer: undefined,
      attendanceRules: undefined,
      lateArrivalPolicy: undefined,
      noShowPolicy: undefined,
      confirmationPolicy: undefined,
      capacityPolicy: undefined,
      safetyPolicy: undefined,
      weatherPolicy: undefined,
      reservationRules: undefined,
    },
  } satisfies TourCreateFormValues;
}

function filledFormValues(): TourCreateFormValues {
  const base = emptyFormValues();
  return {
    ...base,
    overview: { ...base.overview, title: "تور تستی" },
    pricing: { ...base.pricing, basePrice: 1_000_000 },
    itinerary: {
      days: [
        { dayNumber: 1, title: "روز اول", description: undefined, segments: [{ title: undefined, description: undefined, activityType: undefined, maxAltitudeMeters: undefined, elevationGainMeters: undefined, distanceKm: undefined, estimatedDurationHours: undefined, startTime: undefined, endTime: undefined, locationName: undefined }] },
      ],
    },
    logistics: { ...base.logistics, primaryTransportMode: "bus" },
  } satisfies TourCreateFormValues;
}

test("validateForAutosave: hidden rail step is a no-op (urban_event logistics)", () => {
  const result = validateForAutosave("urban_event", "logistics", emptyFormValues());
  assert.equal(result.isValid, true);
  assert.equal(result.ok, true);
  assert.equal(Object.keys(result.fieldErrors).length, 0);
  assert.equal(result.messages.length, 0);
});

test("validateForAutosave: visible step uses rules layer and stays permissive in v1", () => {
  for (const p of TOUR_FORM_PROFILE_VALUES) {
    const visible = getVisibleStepIds(p);
    const stepId = visible[0] ?? "basic";
    const result = validateForAutosave(p, stepId, emptyFormValues());
    assert.equal(result.isValid, true, `autosave should pass for profile ${p} step ${stepId}`);
    assert.equal(result.ok, true);
    assert.equal(result.issues.length, 0);
    assert.equal(result.messages.length, 0);
  }
});

test("validateForSubmit on general: empty form fails on the 4 canonical required fields", () => {
  const result = validateForSubmit("general", emptyFormValues());
  assert.equal(result.isValid, false);
  assert.equal(result.ok, false);
  assert.equal(result.fieldErrors["overview.title"], "عنوان تور را وارد کنید.");
  assert.equal(Object.keys(result.fieldErrors).length, result.issues.length);
  const paths = result.issues.map((i) => i.path).sort();
  assert.deepEqual(paths, [
    "itinerary.days",
    "logistics.primaryTransportMode",
    "overview.title",
    "pricing.basePrice",
  ]);
});

test("validateForSubmit on general: filled form passes", () => {
  const result = validateForSubmit("general", filledFormValues());
  assert.equal(result.isValid, true);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("validateForSubmit on urban_event: itinerary + logistics + capacity steps hidden, so no required-issues for those paths", () => {
  const result = validateForSubmit("urban_event", emptyFormValues());
  const paths = result.issues.map((i) => i.path).sort();
  // urban_event hides capacity, itinerary, participation, logistics — only overview.title remains required.
  assert.deepEqual(paths, ["overview.title"]);
});

test("validateForSubmit on cinema_event: itinerary + capacity hidden, but logistics + basic still enforced", () => {
  const result = validateForSubmit("cinema_event", emptyFormValues());
  const paths = result.issues.map((i) => i.path).sort();
  // cinema_event hides capacity + itinerary + participation. logistics (with primaryTransportMode) stays.
  assert.deepEqual(paths, ["logistics.primaryTransportMode", "overview.title"]);
});

test("validateForStepNavigation: empty title on `basic` step fails for every profile (basic_info is always active)", () => {
  for (const p of TOUR_FORM_PROFILE_VALUES) {
    const visible = getVisibleStepIds(p);
    const result = validateForStepNavigation(p, "basic", emptyFormValues(), visible);
    assert.equal(result.ok, false, `basic should fail for profile ${p}`);
    assert.ok(
      result.issues.some((i) => i.path === "overview.title"),
      `basic step should report missing overview.title for profile ${p}`,
    );
  }
});

test("validateForStepNavigation: leaving `logistics` requires primaryTransportMode for general", () => {
  const visible = getVisibleStepIds("general");
  const result = validateForStepNavigation("general", "logistics", emptyFormValues(), visible);
  assert.equal(result.ok, false);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]!.path, "logistics.primaryTransportMode");
});

test("validateForStepNavigation: hidden step is a no-op (urban_event leaving `logistics`)", () => {
  const visible = getVisibleStepIds("urban_event");
  // urban_event doesn't visit `logistics`, but if a caller passes it anyway, the validator
  // must not invent issues. This guards against runtime drift where visibleSteps and stepId
  // disagree (e.g. profile flip mid-flow).
  const result = validateForStepNavigation("urban_event", "logistics", emptyFormValues(), visible);
  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
});

test("validateForStepNavigation: a populated `itinerary` step passes for general", () => {
  const visible = getVisibleStepIds("general");
  const data = filledFormValues();
  const result = validateForStepNavigation("general", "itinerary", data, visible);
  assert.equal(result.ok, true);
});

test("validateForStepNavigation: empty itinerary on cinema_event is allowed (step is hidden)", () => {
  const visible = getVisibleStepIds("cinema_event");
  const data = emptyFormValues();
  const result = validateForStepNavigation("cinema_event", "itinerary", data, visible);
  // Hidden step → no-op.
  assert.equal(result.ok, true);
});

test("requiredFieldsForProfile / requiredFieldsForStep match validator's required set", () => {
  for (const p of TOUR_FORM_PROFILE_VALUES) {
    const required = new Set(requiredFieldsForProfile(p));
    const result = validateForSubmit(p, emptyFormValues());
    const reported = new Set(result.issues.map((i) => i.path));
    assert.deepEqual([...required].sort(), [...reported].sort(), `mismatch for profile ${p}`);
  }
});

test("requiredFieldsForStep filters by belongsToStep", () => {
  // basic_info → only overview.title is required
  assert.deepEqual([...requiredFieldsForStep("general", "basic")], ["overview.title"]);
  // capacity → pricing.basePrice (logistics.groupSizeMin / Max are optional)
  assert.deepEqual([...requiredFieldsForStep("general", "capacity")], ["pricing.basePrice"]);
  // logistics → primaryTransportMode
  assert.deepEqual([...requiredFieldsForStep("general", "logistics")], ["logistics.primaryTransportMode"]);
  // itinerary → itinerary.days
  assert.deepEqual([...requiredFieldsForStep("general", "itinerary")], ["itinerary.days"]);
  // theme / participation / policies / location / review → no required fields
  for (const step of ["theme", "participation", "policies", "location", "review"] as const) {
    assert.deepEqual(
      [...requiredFieldsForStep("general", step)],
      [],
      `step ${step} should have no required fields`,
    );
  }
});

test("validateForStepNavigation never reports a path that doesn't belong to the step", () => {
  const visible = getVisibleStepIds("general");
  for (const stepId of wizardSteps) {
    const result = validateForStepNavigation("general", stepId as TourCreateWizardStepId, emptyFormValues(), visible);
    for (const issue of result.issues) {
      // The path's first segment should align with the step's owned roots — at minimum, every
      // reported path is one of the four required paths (overview.title for basic, etc.).
      assert.ok(
        ["overview.title", "pricing.basePrice", "itinerary.days", "logistics.primaryTransportMode"].includes(issue.path),
        `unexpected required path ${issue.path} reported by stepNav(${stepId})`,
      );
    }
  }
});
