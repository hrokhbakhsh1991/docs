import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VALUES } from "@repo/types";

import {
  STEP_PRIMARY_FIELD_GROUP,
  getVisibleWizardStepsForProfile,
  pruneWizardStepsWithoutActiveThemes,
} from "./fieldGroups";
import {
  stepTitlesFa,
  stepTriggerFields,
  wizardSteps,
} from "./stepConfig";
import { tourFormProfileToWizardValidationFlags } from "@/components/tours/wizard/schemas/tourCreateValidationPolicy";

import {
  WIZARD_STEP_CONFIGS,
  wizardStepEngine,
} from "./wizardStepEngine";

/**
 * Parity guarantees. Each accessor on `wizardStepEngine` must agree with the underlying
 * primitive it wraps, for every step and every profile. If anything here fails after a change
 * to `stepConfig` / `fieldGroups` / `tourCreateValidationPolicy`, that change MUST be reflected
 * in the engine to keep the single-source-of-truth contract intact.
 */

test("WIZARD_STEP_CONFIGS preserves canonical step order from stepConfig.wizardSteps", () => {
  assert.deepEqual(
    WIZARD_STEP_CONFIGS.map((c) => c.id),
    [...wizardSteps],
  );
});

test("WIZARD_STEP_CONFIGS exposes primaryGroup / triggerFields / titleFa per step", () => {
  for (const cfg of WIZARD_STEP_CONFIGS) {
    assert.equal(cfg.primaryGroup, STEP_PRIMARY_FIELD_GROUP[cfg.id], `primaryGroup for "${cfg.id}"`);
    assert.deepEqual(cfg.triggerFields, stepTriggerFields[cfg.id], `triggerFields for "${cfg.id}"`);
    assert.equal(cfg.titleFa, stepTitlesFa[cfg.id], `titleFa for "${cfg.id}"`);
  }
});

test("getOrderedSteps + getOrderedConfigs return references aligned with stepConfig", () => {
  assert.deepEqual([...wizardStepEngine.getOrderedSteps()], [...wizardSteps]);
  assert.equal(wizardStepEngine.getOrderedConfigs(), WIZARD_STEP_CONFIGS);
});

test("getStepConfig: returns config for every step id", () => {
  for (const id of wizardSteps) {
    const cfg = wizardStepEngine.getStepConfig(id);
    assert.equal(cfg.id, id);
    assert.equal(cfg.primaryGroup, STEP_PRIMARY_FIELD_GROUP[id]);
    assert.deepEqual(cfg.triggerFields, stepTriggerFields[id]);
    assert.equal(cfg.titleFa, stepTitlesFa[id]);
  }
});

test("getTriggerFieldsForStep delegates to stepConfig.stepTriggerFields", () => {
  for (const id of wizardSteps) {
    assert.deepEqual(
      wizardStepEngine.getTriggerFieldsForStep(id),
      stepTriggerFields[id],
      `triggerFields for "${id}" must match stepConfig`,
    );
  }
});

test("getPrimaryGroupForStep delegates to fieldGroups.STEP_PRIMARY_FIELD_GROUP", () => {
  for (const id of wizardSteps) {
    assert.equal(
      wizardStepEngine.getPrimaryGroupForStep(id),
      STEP_PRIMARY_FIELD_GROUP[id],
      `primaryGroup for "${id}" must match fieldGroups`,
    );
  }
});

test("getStepTitleFa delegates to stepConfig.stepTitlesFa", () => {
  for (const id of wizardSteps) {
    assert.equal(wizardStepEngine.getStepTitleFa(id), stepTitlesFa[id]);
  }
});

test("getStepsForProfile matches getVisibleWizardStepsForProfile for every profile", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    assert.deepEqual(
      [...wizardStepEngine.getStepsForProfile(profile)],
      [...getVisibleWizardStepsForProfile(profile)],
      `visible steps must match for profile "${profile}"`,
    );
  }
});

test("getVisibleStepsForRuntime composes profile visibility + theme prune", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const baseProfileSteps = [...getVisibleWizardStepsForProfile(profile)];

    // Catalog still loading: prune is a no-op.
    assert.deepEqual(
      wizardStepEngine.getVisibleStepsForRuntime(profile, {
        themesQueryFinishedLoading: false,
        activeThemeCount: 0,
      }),
      pruneWizardStepsWithoutActiveThemes(baseProfileSteps, {
        themesQueryFinishedLoading: false,
        activeThemeCount: 0,
      }),
      `loading-state prune for "${profile}"`,
    );

    // Catalog loaded with at least one active theme: still no-op.
    assert.deepEqual(
      wizardStepEngine.getVisibleStepsForRuntime(profile, {
        themesQueryFinishedLoading: true,
        activeThemeCount: 3,
      }),
      pruneWizardStepsWithoutActiveThemes(baseProfileSteps, {
        themesQueryFinishedLoading: true,
        activeThemeCount: 3,
      }),
      `loaded-with-themes prune for "${profile}"`,
    );

    // Catalog loaded but empty: theme step must be removed.
    const pruned = wizardStepEngine.getVisibleStepsForRuntime(profile, {
      themesQueryFinishedLoading: true,
      activeThemeCount: 0,
    });
    assert.ok(!pruned.includes("theme"), `theme step removed when catalog empty (profile "${profile}")`);
    assert.deepEqual(
      pruned,
      pruneWizardStepsWithoutActiveThemes(baseProfileSteps, {
        themesQueryFinishedLoading: true,
        activeThemeCount: 0,
      }),
      `empty-catalog prune for "${profile}"`,
    );
  }
});

test("getValidationFlagsForStep: profile-static flags survive even on later steps", () => {
  const urbanSteps = [...wizardStepEngine.getStepsForProfile("urban_event")];
  const last = urbanSteps[urbanSteps.length - 1]!;
  const flags = wizardStepEngine.getValidationFlagsForStep("urban_event", last, urbanSteps);
  const staticFlags = tourFormProfileToWizardValidationFlags("urban_event");
  // For urban_event both flags are profile-static true, so they must remain true on the last step.
  assert.equal(flags.relaxItineraryMinDays, staticFlags.relaxItineraryMinDays);
  assert.equal(flags.relaxLogisticsPrimary, staticFlags.relaxLogisticsPrimary);
  assert.equal(flags.relaxItineraryMinDays, true);
  assert.equal(flags.relaxLogisticsPrimary, true);
});

test("getValidationFlagsForStep: position-aware relax — before itinerary/logistics for general profile", () => {
  const generalSteps = [...wizardStepEngine.getStepsForProfile("general")];
  assert.ok(generalSteps.includes("itinerary"), "general profile must include itinerary");
  assert.ok(generalSteps.includes("logistics"), "general profile must include logistics");

  // On step `basic` (first), both itinerary and logistics are AFTER → both relaxed.
  const onBasic = wizardStepEngine.getValidationFlagsForStep("general", "basic", generalSteps);
  assert.equal(onBasic.relaxItineraryMinDays, true);
  assert.equal(onBasic.relaxLogisticsPrimary, true);

  // On step `itinerary`, we are AT itinerary (not before), and still before logistics.
  const onItinerary = wizardStepEngine.getValidationFlagsForStep("general", "itinerary", generalSteps);
  assert.equal(onItinerary.relaxItineraryMinDays, false);
  assert.equal(onItinerary.relaxLogisticsPrimary, true);

  // On step `policies` (after both), no position-based relax (and general has no profile-static relax).
  const onPolicies = wizardStepEngine.getValidationFlagsForStep("general", "policies", generalSteps);
  assert.equal(onPolicies.relaxItineraryMinDays, false);
  assert.equal(onPolicies.relaxLogisticsPrimary, false);
});

test("getValidationFlagsForStep: when a step is not in `visibleSteps`, both flags fall back to profile-static", () => {
  // Cinema hides itinerary + participation; the wizard could never call this with currentStep="itinerary",
  // but if it did, the engine must not crash and must return profile-static flags.
  const cinemaSteps = [...wizardStepEngine.getStepsForProfile("cinema_event")];
  const flags = wizardStepEngine.getValidationFlagsForStep("cinema_event", "itinerary", cinemaSteps);
  const staticFlags = tourFormProfileToWizardValidationFlags("cinema_event");
  assert.equal(flags.relaxItineraryMinDays, staticFlags.relaxItineraryMinDays);
  assert.equal(flags.relaxLogisticsPrimary, staticFlags.relaxLogisticsPrimary);
});

test("every primary-group step has at least one trigger field except `review`", () => {
  for (const cfg of WIZARD_STEP_CONFIGS) {
    if (cfg.id === "review") {
      assert.equal(cfg.triggerFields.length, 0, "review step has no trigger fields");
    } else {
      assert.ok(cfg.triggerFields.length > 0, `step "${cfg.id}" must declare trigger fields`);
    }
  }
});
