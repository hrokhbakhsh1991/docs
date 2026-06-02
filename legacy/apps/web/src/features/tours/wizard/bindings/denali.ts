"use client";

import { Fragment, createElement, lazy, type ComponentType, type LazyExoticComponent } from "react";
import { denaliWizardSteps, type DenaliCreateWizardStepId } from "@repo/denali-domain";
import type { DenaliTourKind, TourFormProfile } from "@repo/types";

import { DenaliStepFocusBridge } from "@/features/tours/wizard/denali/DenaliStepFocusBridge";
import { readDenaliCanonicalBasics } from "@/features/tours/wizard/denali/denaliCanonicalBasicsControl";
import type { DenaliRuleModel } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import type { DenaliUIContextOptions } from "@/features/tours/wizard/denali/rules/denaliUIAdapter";
import {
  collectDenaliNonVisibleFormPaths,
  getDenaliWizardVisibleSteps,
  withDenaliWizardRailTestingOverrides,
} from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import { readFormValueAtPath } from "@/features/tours/wizard/shell/fieldAccess";
import type {
  GearCatalogFilter,
  HiddenFieldEviction,
  LayoutBindings,
  LayoutOverrides,
  StepComponentRegistry,
  StepPanelComponent,
  StepRailManifest,
} from "@/features/tours/wizard/shell/layout";

type StepModuleLoader = () => Promise<Record<string, ComponentType>>;

function lazyStep(
  stepId: DenaliCreateWizardStepId,
  loadModule: StepModuleLoader,
  exportName: string,
): StepPanelComponent {
  const LazyPanel: LazyExoticComponent<ComponentType<Record<string, never>>> = lazy(async () => {
    const mod = await loadModule();
    const Panel = mod[exportName];
    if (Panel == null) {
      throw new Error(`Missing step export "${exportName}" for ${stepId}`);
    }
    return { default: Panel as ComponentType<Record<string, never>> };
  });

  function StepPanel() {
    return createElement(
      Fragment,
      null,
      createElement(DenaliStepFocusBridge, { stepId }),
      createElement(LazyPanel),
    );
  }
  StepPanel.displayName = `DenaliStepPanel(${stepId})`;
  return StepPanel;
}

function buildStepRegistry(): StepComponentRegistry {
  return {
    denali_basic: lazyStep(
      "denali_basic",
      () => import("@/features/tours/wizard/denali/steps/DenaliBasicInfoStep"),
      "DenaliBasicInfoStep",
    ),
    denali_photos: lazyStep(
      "denali_photos",
      () => import("@/features/tours/wizard/denali/steps/DenaliPhotosStep"),
      "DenaliPhotosStep",
    ),
    denali_program: lazyStep(
      "denali_program",
      () => import("@/features/tours/wizard/denali/steps/DenaliProgramNatureStep"),
      "DenaliProgramNatureStep",
    ),
    denali_logistics: lazyStep(
      "denali_logistics",
      () => import("@/features/tours/wizard/denali/steps/DenaliLogisticsStep"),
      "DenaliLogisticsStep",
    ),
    denali_pricing: lazyStep(
      "denali_pricing",
      () => import("@/features/tours/wizard/denali/steps/DenaliPricingStep"),
      "DenaliPricingStep",
    ),
    denali_legal: lazyStep(
      "denali_legal",
      () => import("@/features/tours/wizard/denali/steps/DenaliLegalStep"),
      "DenaliLegalStep",
    ),
    review: lazyStep(
      "review",
      () => import("@/features/tours/wizard/denali/steps/DenaliReviewStep"),
      "DenaliReviewStep",
    ),
  };
}

let stepRegistrySingleton: StepComponentRegistry | null = null;

function getStepRegistry(): StepComponentRegistry {
  if (stepRegistrySingleton == null) {
    stepRegistrySingleton = buildStepRegistry();
  }
  return stepRegistrySingleton;
}

function resolveCategoryFromTourKind(
  fieldValue: unknown,
  _profile: TourFormProfile,
): string | undefined {
  return readDenaliCanonicalBasics(fieldValue as DenaliTourKind | undefined)?.category;
}

const PROFILE_GEAR_PATH: Partial<Record<TourFormProfile, string>> = {
  denali_pilot: "basicInfo.tourType",
  urban_event: "basicInfo.tourType",
  mountain_outdoor: "basicInfo.tourType",
  nature_trip: "basicInfo.tourType",
};

const gearFilterCache = new Map<string, GearCatalogFilter>();
const stepRailCache = new Map<boolean, StepRailManifest>();

function buildGearFilter(
  profile: TourFormProfile,
  overrides: LayoutOverrides | undefined,
): GearCatalogFilter {
  const classificationFieldPath =
    overrides?.gearClassificationFieldPath ??
    PROFILE_GEAR_PATH[profile] ??
    "basicInfo.tourType";
  const cacheKey = `${profile}:${classificationFieldPath}`;
  const cached = gearFilterCache.get(cacheKey);
  if (cached != null) {
    return cached;
  }

  const strategy: GearCatalogFilter = {
    classificationFieldPath,
    readFieldValue: readFormValueAtPath,
    resolveCategorySlug: resolveCategoryFromTourKind,
  };
  gearFilterCache.set(cacheKey, strategy);
  return strategy;
}

function buildStepRail(overrides: LayoutOverrides | undefined): StepRailManifest {
  const enableRailTestingOverrides =
    overrides?.enableRailTestingOverrides ?? process.env.NODE_ENV === "development";
  const cached = stepRailCache.get(enableRailTestingOverrides);
  if (cached != null) {
    return cached;
  }

  const manifest: StepRailManifest = {
    stepIds: denaliWizardSteps,
    enableRailTestingOverrides,
    resolveVisibleSteps({ form, ruleContext, stepIds, enableRailTestingOverrides: railTestingEnabled }) {
      const ruleSet = ruleContext as DenaliRuleSet;
      const raw = getDenaliWizardVisibleSteps(
        form as DenaliCreateTourWizardForm,
        ruleSet,
        stepIds as readonly DenaliCreateWizardStepId[],
      );
      if (!railTestingEnabled) {
        return raw;
      }
      return withDenaliWizardRailTestingOverrides(raw, { enabled: true });
    },
  };
  stepRailCache.set(enableRailTestingOverrides, manifest);
  return manifest;
}

const hiddenFieldEviction: HiddenFieldEviction = {
  collectHiddenFormPaths({ form, ruleContext, uiOptions }) {
    return collectDenaliNonVisibleFormPaths(
      form as DenaliCreateTourWizardForm,
      ruleContext as DenaliRuleModel,
      uiOptions as DenaliUIContextOptions | undefined,
    );
  },
};

export const denaliBindings: LayoutBindings = {
  buildStepRail,
  buildStepComponentMap: getStepRegistry,
  buildGearCatalogFilter: buildGearFilter,
  hiddenFieldEviction,
};
