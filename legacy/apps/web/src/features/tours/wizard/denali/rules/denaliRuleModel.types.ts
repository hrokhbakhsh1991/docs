/**
 * Denali rule-engine types (hand-maintained).
 * {@link ./denaliRuleSet.generated.ts} is generated from {@link ../registry/DenaliFieldRegistry.ts}.
 */

import type { TourFormProfile } from "@repo/types";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";

export const DENALI_RULE_MODEL_CATEGORIES = [
  "mountain",
  "nature",
  "desert",
  "event",
] as const;

export type DenaliRuleModelCategory = (typeof DENALI_RULE_MODEL_CATEGORIES)[number];

export const DENALI_RULE_MODEL_DURATIONS = ["single_day", "multi_day"] as const;

export type DenaliRuleModelDuration = (typeof DENALI_RULE_MODEL_DURATIONS)[number];

/** Wizard rail step id — field ownership matches {@link DenaliCreateWizardStepId} only. */
export type DenaliRuleFieldStep = DenaliCreateWizardStepId;

export interface DenaliRuleFieldDefinition {
  /** Canonical domain path (registry `canonicalPath`). */
  path: string;
  required: boolean;
  hidden: boolean;
  step: DenaliRuleFieldStep;
}

export interface DenaliRuleModel {
  category: DenaliRuleModelCategory;
  duration: DenaliRuleModelDuration;
  fields: DenaliRuleFieldDefinition[];
}

export type DenaliRuleSet = {
  [_C in DenaliRuleModelCategory]: {
    [_D in DenaliRuleModelDuration]: DenaliRuleModel | null;
  };
};

export type DenaliRuleModelKey = `${DenaliRuleModelCategory}:${DenaliRuleModelDuration}`;

export const DENALI_RULE_MODEL_VERSION = "1.2.0" as const;

/** UI options for invariant engine (mirrors {@link DenaliUIContextOptions} without importing the adapter). */
export type DenaliInvariantEngineUiOptions = {
  readonly mainThemeFormProfile?: TourFormProfile;
};

/** RuleSet + resolved model passed into structural invariant application. */
export interface DenaliInvariantEngineContext {
  readonly ruleSet: DenaliRuleSet;
  readonly model: DenaliRuleModel | null;
  readonly uiOptions?: DenaliInvariantEngineUiOptions;
}
