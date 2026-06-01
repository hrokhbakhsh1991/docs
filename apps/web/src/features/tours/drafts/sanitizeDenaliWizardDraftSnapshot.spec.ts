import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { getDenaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";
import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";

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
  }, denaliRuleSet);

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
  }, denaliRuleSet);

  assert.equal(sanitized.form.programNature.shortDescription, form.programNature.shortDescription);
  assert.equal(sanitized.currentStepIndex, 2);
});

test("sanitizeDenaliWizardDraftSnapshot strips non-registry root keys via prune", () => {
  const form = buildDenaliTourCreateDefaultValues() as DenaliCreateTourWizardForm &
    Record<string, unknown>;
  form.__smuggledDraftRoot = "poison";

  const sanitized = sanitizeDenaliWizardDraftSnapshot(
    {
      form,
      currentStepIndex: 0,
      railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
    },
    denaliRuleSet,
  );

  assert.equal(
    (sanitized.form as DenaliCreateTourWizardForm & Record<string, unknown>).__smuggledDraftRoot,
    undefined,
  );
});

const GHOST_GATHERING_KEY = "__ghostGatheringPointRowKey";

test("sanitizeDenaliWizardDraftSnapshot strips ghost keys inside gatheringPoints rows", () => {
  const form = buildDenaliTourCreateTestValues();
  form.tripDetails = {
    ...form.tripDetails,
    logistics: {
      ...form.tripDetails.logistics,
      gatheringPoints: [
        {
          title: "Meet",
          time: "08:00",
          location: { addressText: "Station", latitude: 35.7, longitude: 51.4 },
          [GHOST_GATHERING_KEY]: "must not survive draft sanitize",
        } as NonNullable<
          DenaliCreateTourWizardForm["tripDetails"]["logistics"]
        >["gatheringPoints"][number] & { [GHOST_GATHERING_KEY]: string },
      ],
    },
  };

  const sanitized = sanitizeDenaliWizardDraftSnapshot(
    {
      form,
      currentStepIndex: 1,
      railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
    },
    denaliRuleSet,
  );

  const row = sanitized.form.tripDetails.logistics?.gatheringPoints?.[0] as Record<string, unknown>;
  assert.equal(row?.title, "Meet");
  assert.equal(row?.[GHOST_GATHERING_KEY], undefined);
});

test("sanitizeDenaliWizardDraftSnapshot prunes legacy keys not present in registry", () => {
  const form = buildDenaliTourCreateTestValues() as unknown as Record<string, unknown>;
  const basicInfo = form.basicInfo as Record<string, unknown>;
  basicInfo.isMultiDay = true;

  const sanitized = sanitizeDenaliWizardDraftSnapshot({
    form: form as unknown as DenaliCreateTourWizardForm,
    currentStepIndex: 1,
    railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
  }, denaliRuleSet);

  const sanitizedBasic = sanitized.form.basicInfo as Record<string, unknown>;
  assert.equal(sanitizedBasic.isMultiDay, undefined);
  assert.equal(
    sanitized.form.programNature.shortDescription,
    (form.programNature as Record<string, unknown>).shortDescription,
  );
});
