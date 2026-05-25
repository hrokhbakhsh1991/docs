/**
 * Rule-engine compliance: flat {@link DenaliTourEditForm} uses the same step components and
 * {@link useDenaliStepFieldRules} pipeline as the create wizard (via {@link DenaliCanonicalProvider}).
 *
 * These tests simulate edit vs wizard visibility without mounting React — both paths call
 * {@link isDenaliFieldVisibleOnStep} / {@link getDenaliUIFromForm}.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { DenaliTransportMode } from "@repo/types";

import { transformTourToDenaliWizardValues } from "@/features/tours/clone/transformTourToDenaliWizardValues";
import type { TourCloneSourceDto } from "@/features/tours/clone/transformTourToWizardValues";
import { readDenaliCanonicalBasics } from "@/features/tours/wizard/denali/denaliCanonicalBasicsControl";
import {
  denaliCanonicalToForm,
  denaliFormToCanonical,
} from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import {
  denaliWizardSteps,
  type DenaliCreateWizardStepId,
} from "@/features/tours/wizard/denaliStepConfig";
import { mergeDenaliWizardDefaults } from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import {
  evaluateFormFieldRule,
  evaluateFormRules,
} from "@/features/tours/wizard/denali/rules/evaluateFormRules";
import { mapDenaliCanonicalToFormPath } from "@/features/tours/wizard/denali/rules/denaliRuleRequired";
import {
  getDenaliUIFromForm,
  isDenaliFieldRequiredOnStep,
  isDenaliFieldVisibleOnStep,
} from "@/features/tours/wizard/denali/rules/denaliUIAdapter";
import { finalizeDenaliWizardHydration } from "@/features/tours/wizard/denali/denaliFormHydration";
import { patchDenaliTransportForMode } from "@/features/tours/wizard/denali/transport/patchDenaliTransportForMode";
import { applyDenaliInvariantState } from "@/features/tours/wizard/denali/validation/denaliInvariantEngine";
import {
  prepareDenaliWizardFormForSubmit,
  resolveDenaliRuleModelFromForm,
} from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import {
  buildDenaliTourCreateDefaultValues,
  buildDenaliTourCreateTestValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { normalizeDenaliWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

/** Mirrors `denaliEditSections` in DenaliTourEditForm.tsx (flat layout, no review). */
const DENALI_EDIT_FORM_STEPS = denaliWizardSteps.filter(
  (step): step is Exclude<DenaliCreateWizardStepId, "review"> => step !== "review",
);

const LOGISTICS_STEP = "denali_logistics" as const;
const ADMIN_CAPACITY_PATH = "transport.adminCapacityApproval";

function makeMockTourForEdit(overrides: Partial<TourCloneSourceDto> = {}): TourCloneSourceDto {
  return {
    title: "Denali edit rule-engine tour",
    description: "long description for edit form tests",
    tourType: "mountain",
    destinationId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    costContext: { totalCost: 500_000, requiresPayment: true },
    transportModes: ["bus", "private_car"],
    details: {
      tripDetails: {
        overview: {
          denaliTourKind: "mountain_day",
          shortIntro: "short",
          tourThemeIds: ["b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"],
          difficultyLevel: 5.5,
        },
        logistics: {
          departureDate: "2026-08-10",
          departureMeetingTime: "08:30",
          primaryTransportMode: "bus",
          privateCarMode: "car_share_fixed_dong",
          fuelShareToman: 120_000,
          groupSizeMax: 15,
          meetingPoint: "Tehran",
        },
        participation: {
          minimumAge: 18,
          fitnessLevel: "moderate",
          experienceLevel: "basic",
          sportsInsuranceRequired: true,
        },
        itinerary: {
          outline: "day plan",
          programNotes: "مدت تقریبی پیاده‌روی: 4 ساعت",
        },
        policies: {
          cancellationPolicy: "cancel",
        },
      },
    },
    ...overrides,
  };
}

/** Flat edit hydrate: tour DTO → merged defaults → registry cleanup (same as DenaliTourEditForm). */
function buildFlatEditFormFromMockTour(
  overrides: Partial<TourCloneSourceDto> = {},
): DenaliCreateTourWizardForm {
  const patch = transformTourToDenaliWizardValues(makeMockTourForEdit(overrides), { mode: "clone" });
  const merged = mergeDenaliWizardDefaults(buildDenaliTourCreateDefaultValues(), patch);
  return finalizeDenaliWizardHydration(
    prepareDenaliWizardFormForSubmit(merged),
  );
}

/** What {@link useDenaliStepFieldRules} calls on each stacked edit section. */
function editFormFieldVisible(
  stepId: DenaliCreateWizardStepId,
  formPath: string,
  form: DenaliCreateTourWizardForm,
): boolean {
  const model = resolveDenaliRuleModelFromForm(form);
  return isDenaliFieldVisibleOnStep(model, stepId, formPath, form);
}

function editFormFieldRequired(
  stepId: DenaliCreateWizardStepId,
  formPath: string,
  form: DenaliCreateTourWizardForm,
): boolean {
  const model = resolveDenaliRuleModelFromForm(form);
  return isDenaliFieldRequiredOnStep(model, stepId, formPath, form);
}

/** What {@link DenaliCanonicalProvider} exposes as `ui.isVisible` on wizard steps. */
function wizardStepFieldVisible(
  stepId: DenaliCreateWizardStepId,
  formPath: string,
  form: DenaliCreateTourWizardForm,
): boolean {
  return getDenaliUIFromForm(form).isVisible(stepId, formPath, form);
}

function wizardStepFieldRequired(
  stepId: DenaliCreateWizardStepId,
  formPath: string,
  form: DenaliCreateTourWizardForm,
): boolean {
  return getDenaliUIFromForm(form).isRequired(stepId, formPath, form);
}

function assertEditMatchesWizardVisibility(
  stepId: DenaliCreateWizardStepId,
  formPath: string,
  form: DenaliCreateTourWizardForm,
): void {
  assert.equal(
    editFormFieldVisible(stepId, formPath, form),
    wizardStepFieldVisible(stepId, formPath, form),
    `visibility mismatch for ${stepId} / ${formPath}`,
  );
}

function assertEditMatchesWizardRequired(
  stepId: DenaliCreateWizardStepId,
  formPath: string,
  form: DenaliCreateTourWizardForm,
): void {
  assert.equal(
    editFormFieldRequired(stepId, formPath, form),
    wizardStepFieldRequired(stepId, formPath, form),
    `required mismatch for ${stepId} / ${formPath}`,
  );
}

/** Simulates edit logistics transport Select → updateCanonical(patchDenaliTransportForMode). */
function setTransportModeLikeEditForm(
  form: DenaliCreateTourWizardForm,
  mode: DenaliTransportMode,
): DenaliCreateTourWizardForm {
  const canonical = denaliFormToCanonical(form);
  const basics = readDenaliCanonicalBasics(form.basicInfo.tourType);
  const nextTransport = patchDenaliTransportForMode(canonical.transport, mode);
  const nextCanonical = { ...canonical, transport: nextTransport };
  const nextForm = denaliCanonicalToForm(nextCanonical, form, { basics });
  return normalizeDenaliWizardForm(applyDenaliInvariantState(nextForm));
}

function scopedRuleModelFieldsForStep(
  form: DenaliCreateTourWizardForm,
  stepId: DenaliCreateWizardStepId,
): readonly { canonicalPath: string; formPath: string }[] {
  const model = resolveDenaliRuleModelFromForm(form);
  if (model == null) {
    return [];
  }
  return model.fields
    .filter((field) => field.step === stepId)
    .map((field) => ({
      canonicalPath: field.path,
      formPath: mapDenaliCanonicalToFormPath(field.path),
    }));
}

test("flat edit form steps match wizard rail minus review", () => {
  assert.deepEqual(DENALI_EDIT_FORM_STEPS, [
    "denali_basic",
    "denali_program",
    "denali_logistics",
    "denali_pricing",
    "denali_photos",
  ]);
});

test("mock tour hydrate produces mountain_day flat edit form", () => {
  const form = buildFlatEditFormFromMockTour();
  assert.equal(form.basicInfo.tourType, "mountain_day");
  assert.equal(form.basicInfo.title, "Denali edit rule-engine tour");
  assert.equal(form.transport.transportMode, "bus");
});

test("rule-engine: every scoped field on each flat edit section matches wizard visibility", () => {
  const form = buildFlatEditFormFromMockTour();

  for (const stepId of DENALI_EDIT_FORM_STEPS) {
    for (const { formPath } of scopedRuleModelFieldsForStep(form, stepId)) {
      assertEditMatchesWizardVisibility(stepId, formPath, form);
      assertEditMatchesWizardRequired(stepId, formPath, form);
    }
  }
});

test("rule-engine: event single_day program outdoor fields hidden in edit and wizard", () => {
  const form = buildFlatEditFormFromMockTour({
    details: {
      tripDetails: {
        overview: {
          denaliTourKind: "event_cinema",
          shortIntro: "cinema night",
          tourThemeIds: [],
        },
        logistics: {
          departureDate: "2026-09-01",
          departureMeetingTime: "19:00",
          groupSizeMax: 50,
        },
      },
    },
  });

  const stepId = "denali_program" as const;
  assertEditMatchesWizardVisibility(stepId, "programNature.difficultyLevel", form);
  assert.equal(editFormFieldVisible(stepId, "programNature.difficultyLevel", form), false);
  assertEditMatchesWizardVisibility(stepId, "programNature.themeIds", form);
  assert.equal(editFormFieldVisible(stepId, "programNature.themeIds", form), true);
});

test("transport bus + allowPersonalCar → adminCapacityApproval visible in edit and wizard", () => {
  let form = setTransportModeLikeEditForm(buildFlatEditFormFromMockTour(), "bus");
  form.transport.allowPersonalCar = true;

  assert.equal(form.transport.transportMode, "bus");
  assertEditMatchesWizardVisibility(LOGISTICS_STEP, ADMIN_CAPACITY_PATH, form);
  assert.equal(editFormFieldVisible(LOGISTICS_STEP, ADMIN_CAPACITY_PATH, form), true);
  assert.equal(editFormFieldRequired(LOGISTICS_STEP, ADMIN_CAPACITY_PATH, form), false);

  const evaluated = evaluateFormFieldRule(form, ADMIN_CAPACITY_PATH, LOGISTICS_STEP);
  assert.equal(evaluated.visible, true);
  assert.equal(evaluated.required, false);
});

test("transport bus without allowPersonalCar → adminCapacityApproval hidden in edit and wizard", () => {
  let form = setTransportModeLikeEditForm(buildFlatEditFormFromMockTour(), "bus");
  form.transport.allowPersonalCar = undefined;

  assert.equal(form.transport.transportMode, "bus");
  assertEditMatchesWizardVisibility(LOGISTICS_STEP, ADMIN_CAPACITY_PATH, form);
  assert.equal(editFormFieldVisible(LOGISTICS_STEP, ADMIN_CAPACITY_PATH, form), false);

  const evaluated = evaluateFormFieldRule(form, ADMIN_CAPACITY_PATH, LOGISTICS_STEP);
  assert.equal(evaluated.visible, false);
  assert.equal(evaluated.required, false);
});

test("transport mode toggle: dependent logistics fields stay aligned between edit and wizard", () => {
  const modes: DenaliTransportMode[] = [
    "bus",
    "train",
    "organizer_vehicle",
    "shared_cars",
    "none",
  ];

  let form = buildFlatEditFormFromMockTour();

  for (const mode of modes) {
    form = setTransportModeLikeEditForm(form, mode);

    const dependentPaths = [
      "transport.transportCost",
      "transport.allowPersonalCar",
      "transport.dongAmount",
      ADMIN_CAPACITY_PATH,
    ] as const;

    for (const formPath of dependentPaths) {
      assertEditMatchesWizardVisibility(LOGISTICS_STEP, formPath, form);
      assertEditMatchesWizardRequired(LOGISTICS_STEP, formPath, form);
    }

    const rules = evaluateFormRules(form, LOGISTICS_STEP);
    for (const formPath of dependentPaths) {
      const row = rules.find((r) => r.formPath === formPath);
      assert.ok(row, `evaluateFormRules missing ${formPath} for mode=${mode}`);
      assert.equal(
        row.visible,
        editFormFieldVisible(LOGISTICS_STEP, formPath, form),
        `evaluateFormRules.visible !== edit for ${formPath} mode=${mode}`,
      );
    }
  }
});

test("transport bus + allowPersonalCar: dongAmount visibility matches wizard after edit patch", () => {
  let form = setTransportModeLikeEditForm(buildFlatEditFormFromMockTour(), "bus");
  form = normalizeDenaliWizardForm({
    ...form,
    transport: { ...form.transport, allowPersonalCar: undefined },
  });

  assertEditMatchesWizardVisibility(LOGISTICS_STEP, "transport.dongAmount", form);
  assert.equal(editFormFieldVisible(LOGISTICS_STEP, "transport.dongAmount", form), false);

  form = normalizeDenaliWizardForm({
    ...form,
    transport: { ...form.transport, allowPersonalCar: true },
  });

  assertEditMatchesWizardVisibility(LOGISTICS_STEP, "transport.dongAmount", form);
  assert.equal(editFormFieldVisible(LOGISTICS_STEP, "transport.dongAmount", form), true);
});

test("publishStatus on denali_basic: edit publish section uses same visibility as wizard", () => {
  const form = buildFlatEditFormFromMockTour();
  const stepId = "denali_basic" as const;

  assertEditMatchesWizardVisibility(stepId, "basicInfo.publishStatus", form);
  assert.equal(editFormFieldVisible(stepId, "basicInfo.publishStatus", form), true);
});

test("built-in test defaults: flat edit matrix matches wizard for all edit sections", () => {
  const form = normalizeDenaliWizardForm(buildDenaliTourCreateTestValues());

  for (const stepId of DENALI_EDIT_FORM_STEPS) {
    for (const { formPath } of scopedRuleModelFieldsForStep(form, stepId)) {
      assertEditMatchesWizardVisibility(stepId, formPath, form);
    }
  }
});
