import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { denaliWizardSteps } from "@repo/denali-domain";

import {
  buildLayout,
  createStepRegistryStub,
  DEFAULT_DRAFT_WATCH_DEBOUNCE_MS,
  isNavigationLocked,
  resolveVisibleSteps,
} from "./shell/layout";

const denaliLayoutOptions = {
  stepComponentMap: createStepRegistryStub(denaliWizardSteps),
} as const;

test("buildLayout defaults draft debounce and gear field path", () => {
  const layout = buildLayout("denali_pilot", null, denaliLayoutOptions);
  assert.equal(layout.draftWatchDebounceMs, DEFAULT_DRAFT_WATCH_DEBOUNCE_MS);
  assert.equal(layout.gearCatalogFilter.classificationFieldPath, "basicInfo.tourType");
  assert.equal(layout.stepRail.stepIds.length, 7);
  assert.equal(layout.lockNavigationDuringConflict, true);
  assert.equal(layout.lockNavigationDuringSubmit, true);
});

test("buildLayout merges tenant wizardLayout overrides", () => {
  const layout = buildLayout("urban_event", {
    id: "tpl",
    workspaceId: "ws",
    baseProfile: "urban_event",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: {},
    presetId: null,
    canonicalData: {
      wizardLayout: {
        draftWatchDebounceMs: 750,
        gearClassificationFieldPath: "basicInfo.tourType",
      },
    },
    wizardContractVersion: 1,
    formProfileVersion: 1,
  }, denaliLayoutOptions);
  assert.equal(layout.draftWatchDebounceMs, 750);
});

test("resolveVisibleSteps uses manifest step ids", () => {
  const form = buildDenaliTourCreateDefaultValues();
  const layout = buildLayout("denali_pilot", null, denaliLayoutOptions);
  const steps = resolveVisibleSteps(layout, form, denaliRuleSet);
  assert.ok(steps.length > 0);
  assert.ok(steps.every((step) => layout.stepRail.stepIds.includes(step)));
});

test("isNavigationLocked respects layout flags", () => {
  const layout = buildLayout("general", null, denaliLayoutOptions);
  assert.equal(
    isNavigationLocked({
      layout: { ...layout, lockNavigationDuringSubmit: false },
      submitLocked: true,
      draftStatus: "IDLE",
    }),
    false,
  );
  assert.equal(
    isNavigationLocked({
      layout,
      submitLocked: false,
      draftStatus: "CONFLICT_RESOLVING",
    }),
    true,
  );
});
