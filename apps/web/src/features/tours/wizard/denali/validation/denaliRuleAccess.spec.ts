import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

import {
  clearDenaliNonVisibleFormValues,
  normalizeDenaliFormPatch,
  normalizeDenaliWizardForm,
  resolveDenaliRuleModelFromForm,
} from "./denaliRuleAccess";

test("normalizeDenaliWizardForm clears outdoor fields for event_cinema", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "event_cinema";
  form.programNature.difficultyLevel = 2;
  form.programNature.hikingHoursApprox = 3;

  const normalized = normalizeDenaliWizardForm(form);
  assert.equal(normalized.programNature.difficultyLevel, undefined);
  assert.equal(normalized.programNature.hikingHoursApprox, undefined);
});

test("normalizeDenaliWizardForm clears endDateTime for single-day kinds", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.endDateTime = "2026-06-03T18:00:00.000Z";

  const normalized = normalizeDenaliWizardForm(form);
  assert.equal(normalized.basicInfo.endDateTime, undefined);
});

test("normalizeDenaliWizardForm strips dongAmount when not shared_cars", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.transport.transportMode = "organizer_vehicle";
  form.transport.dongAmount = 50_000;

  const normalized = normalizeDenaliWizardForm(form);
  assert.equal(normalized.transport.dongAmount, undefined);
});

test("normalizeDenaliFormPatch applies same clears on partial preset shape", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const patch = normalizeDenaliFormPatch(
    {
      basicInfo: { tourType: "event_cinema" } as any,
      programNature: {
        themeIds: defaults.programNature.themeIds,
        shortDescription: "رویداد",
        difficultyLevel: 5,
        hikingHoursApprox: 2,
      },
    },
    defaults,
  );

  assert.equal(patch.programNature?.difficultyLevel, undefined);
  assert.equal(patch.programNature?.hikingHoursApprox, undefined);
});

test("clearDenaliNonVisibleFormValues matches normalizeDenaliWizardForm for mountain_day", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.transport.transportMode = "shared_cars";
  form.transport.dongAmount = 25_000;
  const model = resolveDenaliRuleModelFromForm(form)!;

  const cleared = clearDenaliNonVisibleFormValues(form, model);
  const normalized = normalizeDenaliWizardForm(form);
  assert.deepEqual(cleared.transport, normalized.transport);
});
