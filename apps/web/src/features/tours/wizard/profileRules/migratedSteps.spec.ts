import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VALUES, type TourFormProfile } from "@repo/types";

import type { TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";

import { getStepRules } from "./getProfileRules";
import { requiredFieldsForStep } from "./validation";

/**
 * Per-step rules coverage for the **migrated** wizard steps. Acceptance-criterion 4 of the
 * "TourFormProfile is the canonical truth" review:
 *
 *   For at least the migrated steps, assert for different `TourFormProfile` values:
 *     - which fields are visible on that step,
 *     - which fields are required to move forward,
 *     - that final submit fails/succeeds appropriately.
 *
 * The first two are pure-rules-layer assertions (no JSDOM needed) and live here. The
 * "submit fails/succeeds" axis is covered by `validation.spec.ts`.
 *
 * Migrated steps as of this commit: `basic`, `participation`, `logistics`.
 */

const MIGRATED_STEPS = ["basic", "participation", "logistics"] as const satisfies readonly TourCreateWizardStepId[];
type MigratedStepId = (typeof MIGRATED_STEPS)[number];

type StepProfileExpectation = {
  /** Optional: when omitted, the `general` baseline applies. */
  readonly visible?: readonly string[];
  readonly required: readonly string[];
};

const EXPECTED: Readonly<
  Record<MigratedStepId, Readonly<Record<TourFormProfile, StepProfileExpectation>>>
> = {
  basic: {
    general: {
      visible: [
        "overview.communicationLink",
        "overview.highlights",
        "overview.locationSummary",
        "overview.longDescription",
        "overview.shortDescription",
        "overview.slug",
        "overview.title",
        "overview.tourType",
        "overview.tripStyles",
      ],
      required: ["overview.title"],
    },
    mountain_outdoor: { required: ["overview.title"] },
    nature_trip: { required: ["overview.title"] },
    cultural_tour: { required: ["overview.title"] },
    cinema_event: { required: ["overview.title"] },
    urban_event: { required: ["overview.title"] },
    denali_pilot: { required: ["overview.title"] },
  },
  participation: {
    general: {
      visible: [
        "participation.documentsRequired",
        "participation.gearOptionalIds",
        "participation.gearRequiredIds",
        "participation.genderRestriction",
        "participation.maximumAge",
        "participation.medicalRestrictions",
        "participation.minParticipants",
        "participation.minimumAge",
        "participation.notSuitableFor",
        "participation.registrationNationalIdRequired",
        "participation.requiredExperienceLevel",
        "participation.requiredFitnessLevel",
        "participation.requirements",
        "participation.skillsRequired",
        "participation.sportsInsuranceRequired",
        "participation.suitableFor",
        "participation.technicalSkillRequired",
      ],
      required: [],
    },
    mountain_outdoor: { required: [] },
    nature_trip: { required: [] },
    cultural_tour: { required: [] },
    cinema_event: { visible: [], required: [] },
    urban_event: { visible: [], required: [] },
    denali_pilot: { required: [] },
  },
  logistics: {
    general: {
      visible: [
        "logistics.accommodationDetails",
        "logistics.accommodationNotes",
        "logistics.accommodationTypes",
        "logistics.excludedServices",
        "logistics.fuelShareToman",
        "logistics.guideLanguageIds",
        "logistics.includedServices",
        "logistics.leaderInsuranceNotes",
        "logistics.leaderProvidesInsurance",
        "logistics.mealNotes",
        "logistics.mealPlan",
        "logistics.meetingPointDetails",
        "logistics.optionalServices",
        "logistics.primaryTransportMode",
        "logistics.supplementalPrivateCar",
        "logistics.supportServices",
        "logistics.transportationDetails",
        "logistics.transportationNotes",
      ],
      required: ["logistics.primaryTransportMode"],
    },
    mountain_outdoor: { required: ["logistics.primaryTransportMode"] },
    nature_trip: { required: ["logistics.primaryTransportMode"] },
    cultural_tour: { required: ["logistics.primaryTransportMode"] },
    cinema_event: { required: ["logistics.primaryTransportMode"] },
    urban_event: { visible: [], required: [] },
    denali_pilot: { required: ["logistics.primaryTransportMode"] },
  },
};

function visiblePathsForStep(profile: TourFormProfile, stepId: TourCreateWizardStepId): string[] {
  const sr = getStepRules(profile, stepId);
  if (!sr.step || sr.step.visibility === "hidden") {
    return [];
  }
  return sr.fields
    .filter((f) => f.visibility !== "hidden")
    .map((f) => f.path)
    .sort((a, b) => a.localeCompare(b));
}

for (const stepId of MIGRATED_STEPS) {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const expected = EXPECTED[stepId][profile];
    const expectedVisible: readonly string[] =
      expected.visible ?? EXPECTED[stepId].general.visible ?? [];

    test(`migrated step "${stepId}" / profile "${profile}": visible paths`, () => {
      const got = visiblePathsForStep(profile, stepId);
      assert.deepEqual(got, [...expectedVisible].sort((a, b) => a.localeCompare(b)));
    });

    test(`migrated step "${stepId}" / profile "${profile}": required paths at submit`, () => {
      const got = [...requiredFieldsForStep(profile, stepId)].sort((a, b) => a.localeCompare(b));
      assert.deepEqual(got, [...expected.required].sort((a, b) => a.localeCompare(b)));
    });
  }
}
