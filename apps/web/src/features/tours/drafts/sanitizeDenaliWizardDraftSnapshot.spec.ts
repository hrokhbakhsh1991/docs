import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { getDenaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";

import {
  DENALI_WIZARD_RAIL_LAYOUT_VERSION,
  migrateDenaliDraftStepIndex,
  sanitizeDenaliWizardDraftSnapshot,
} from "./sanitizeDenaliWizardDraftSnapshot";

test("migrateDenaliDraftStepIndex maps legacy program index to new program slot", () => {
  const steps = getDenaliWizardSteps();
  assert.equal(migrateDenaliDraftStepIndex(1, 1), steps.indexOf("denali_program"));
});

test("migrateDenaliDraftStepIndex maps legacy photos index to new photos slot", () => {
  const steps = getDenaliWizardSteps();
  assert.equal(migrateDenaliDraftStepIndex(4, 1), steps.indexOf("denali_photos"));
});

test("migrateDenaliDraftStepIndex keeps current layout indices when railLayoutVersion is current", () => {
  assert.equal(migrateDenaliDraftStepIndex(1, DENALI_WIZARD_RAIL_LAYOUT_VERSION), 1);
  assert.equal(getDenaliWizardSteps()[1], "denali_photos");
});

test("sanitizeDenaliWizardDraftSnapshot purges ghost outdoor fields on event tour type", () => {
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "event_reading";
  form.programNature.difficultyLevel = 8;
  form.programNature.hikingHoursApprox = 10;

  const sanitized = sanitizeDenaliWizardDraftSnapshot({
    form,
    currentStepIndex: 4,
    railLayoutVersion: 1,
  });

  assert.equal(sanitized.form.programNature?.difficultyLevel, undefined);
  assert.equal(sanitized.form.programNature?.hikingHoursApprox, undefined);
  assert.equal(sanitized.currentStepIndex, getDenaliWizardSteps().indexOf("denali_photos"));
  assert.equal(sanitized.railLayoutVersion, DENALI_WIZARD_RAIL_LAYOUT_VERSION);
});

test("sanitizeDenaliWizardDraftSnapshot preserves valid mountain draft content", () => {
  const form = buildDenaliTourCreateTestValues();
  const sanitized = sanitizeDenaliWizardDraftSnapshot({
    form,
    currentStepIndex: 2,
    railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
  });

  assert.equal(sanitized.form.programNature.shortDescription, form.programNature.shortDescription);
  assert.equal(sanitized.currentStepIndex, 2);
});
