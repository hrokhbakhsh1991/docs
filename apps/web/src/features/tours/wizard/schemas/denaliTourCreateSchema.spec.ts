import assert from "node:assert/strict";
import test from "node:test";

import { DENALI_TOUR_KIND_VALUES, denaliTourKindToIsMultiDay } from "@repo/types";

import {
  computeDenaliTourDayCountFromKind,
  syncDenaliItineraryRows,
} from "../denali/denaliItinerarySync";
import {
  buildDenaliTourCreateDefaultValues,
  buildDenaliTourCreateTestValues,
  normalizeDenaliWizardForm,
  type DenaliCreateTourWizardForm,
} from "./denaliTourCreateFormModel";
import {
  denaliTourCreateFormSchema,
  validateDenaliWizardForm,
} from "../denali/validation/denaliWizardFormZod";

function applyValidMultiDayItinerary(values: DenaliCreateTourWizardForm): void {
  const dayCount = computeDenaliTourDayCountFromKind(
    values.basicInfo.tourType,
    values.basicInfo.startDateTime,
    values.basicInfo.endDateTime,
  );
  values.programNature.itinerary = syncDenaliItineraryRows(undefined, dayCount).map((row) => ({
    ...row,
    activities: `فعالیت روز ${row.day}`,
  }));
}

/** Structural base schema only (shape/enums) — not the production submit gate. */
test("denaliTourCreateFormSchema accepts valid mountain_day defaults (structural)", () => {
  const values = buildDenaliTourCreateDefaultValues();
  const result = denaliTourCreateFormSchema.safeParse(values);
  assert.equal(result.success, true, result.success ? "" : JSON.stringify(result.error.issues));
});

test("validateDenaliWizardForm requires endDateTime for multi-day kinds", () => {
  const values = buildDenaliTourCreateDefaultValues();
  values.basicInfo.tourType = "nature_multi";
  values.basicInfo.endDateTime = undefined;
  const result = validateDenaliWizardForm(values);
  assert.equal(result.success, false);
  assert.ok(result.issues.some((i) => i.path.join(".") === "basicInfo.endDateTime"));
});

test("validateDenaliWizardForm accepts desert_multi when endDateTime is set", () => {
  const values = buildDenaliTourCreateTestValues();
  values.basicInfo.tourType = "desert_multi";
  values.basicInfo.endDateTime = "2026-06-03T18:00:00.000Z";
  applyValidMultiDayItinerary(values);
  values.participantRequirements.minimumAge = undefined;
  values.participantRequirements.fitnessLevel = undefined;
  values.participantRequirements.sportsInsuranceRequired = undefined;
  const result = validateDenaliWizardForm(values);
  assert.equal(result.success, true, result.success ? "" : JSON.stringify(result.issues));
});

test("normalize + validateDenaliWizardForm clears outdoor fields for event_cinema", () => {
  const values = buildDenaliTourCreateTestValues();
  values.basicInfo.tourType = "event_cinema";
  values.programNature.difficultyLevel = 2;
  values.programNature.hikingHoursApprox = 3;
  const normalized = normalizeDenaliWizardForm(values);
  assert.equal(normalized.programNature.difficultyLevel, undefined);
  assert.equal(normalized.programNature.hikingHoursApprox, undefined);
  const result = validateDenaliWizardForm(normalized);
  assert.equal(result.success, true, result.success ? "" : JSON.stringify(result.issues));
});

test("normalizeDenaliWizardForm clears endDateTime for single-day kinds", () => {
  const values = buildDenaliTourCreateDefaultValues();
  values.basicInfo.tourType = "mountain_day";
  values.basicInfo.endDateTime = "2026-06-03T18:00:00.000Z";
  const normalized = normalizeDenaliWizardForm(values);
  assert.equal(normalized.basicInfo.endDateTime, undefined);
});

test("validateDenaliWizardForm requires basePricePerPerson when paid", () => {
  const values = buildDenaliTourCreateDefaultValues();
  values.pricingPayment.requiresPayment = true;
  values.pricingPayment.basePricePerPerson = undefined;
  const result = validateDenaliWizardForm(values);
  assert.equal(result.success, false);
  assert.ok(
    result.issues.some((i) => i.path.join(".") === "pricingPayment.basePricePerPerson"),
  );
});

test("validateDenaliWizardForm rejects dongAmount zero when shared_cars", () => {
  const values = buildDenaliTourCreateDefaultValues();
  values.transport.transportMode = "shared_cars";
  values.transport.dongAmount = 0;
  const result = validateDenaliWizardForm(values);
  assert.equal(result.success, false);
  assert.ok(result.issues.some((i) => i.path.join(".") === "transport.dongAmount"));
});

test("validateDenaliWizardForm requires dongAmount when shared_cars", () => {
  const values = buildDenaliTourCreateDefaultValues();
  values.transport.transportMode = "shared_cars";
  values.transport.dongAmount = undefined;
  const result = validateDenaliWizardForm(values);
  assert.equal(result.success, false);
  assert.ok(result.issues.some((i) => i.path.join(".") === "transport.dongAmount"));
});

test("normalizeDenaliWizardForm strips dongAmount when not shared_cars", () => {
  const values = buildDenaliTourCreateDefaultValues();
  values.transport.transportMode = "organizer_vehicle";
  values.transport.dongAmount = 50_000;
  const normalized = normalizeDenaliWizardForm(values);
  assert.equal(normalized.transport.dongAmount, undefined);
});

test("validateDenaliWizardForm covers all Denali tour kinds (submit gate)", () => {
  for (const kind of DENALI_TOUR_KIND_VALUES) {
    const values = buildDenaliTourCreateTestValues();
    values.basicInfo.tourType = kind;
    if (denaliTourKindToIsMultiDay(kind)) {
      values.basicInfo.endDateTime = "2026-06-03T18:00:00.000Z";
      applyValidMultiDayItinerary(values);
    } else {
      values.basicInfo.endDateTime = undefined;
    }
    if (kind.startsWith("event_")) {
      values.programNature.difficultyLevel = undefined;
      values.programNature.hikingHoursApprox = undefined;
    } else {
      values.programNature.difficultyLevel = 5;
      values.programNature.hikingHoursApprox = 3;
    }
    if (!kind.startsWith("mountain_")) {
      values.participantRequirements.minimumAge = undefined;
      values.participantRequirements.fitnessLevel = undefined;
      values.participantRequirements.sportsInsuranceRequired = undefined;
    }
    const result = validateDenaliWizardForm(values);
    assert.equal(
      result.success,
      true,
      `${kind}: ${result.success ? "" : JSON.stringify(result.issues)}`,
    );
  }
});
