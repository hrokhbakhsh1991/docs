/**
 * Denali rule-engine types (hand-maintained).
 * {@link ./denaliRuleSet.generated.ts} is generated from {@link ../registry/DenaliFieldRegistry.ts}.
 */

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
  [C in DenaliRuleModelCategory]: {
    [D in DenaliRuleModelDuration]: DenaliRuleModel | null;
  };
};

export type DenaliRuleModelKey = `${DenaliRuleModelCategory}:${DenaliRuleModelDuration}`;

export const DENALI_RULE_MODEL_VERSION = "1.2.0" as const;
