// DEPRECATED: DO NOT EDIT field matrices or denaliRuleSet here — AUTO-GENERATED from the registry.
// Edit denaliFieldRegistryData.ts + denaliRuleMatrixRecipes.ts, then: pnpm --filter web generate:denali-wizard
/**
 * Denali rule engine — UI visibility and required state.
 *
 * Field matrices are generated from {@link ../registry/denaliFieldRegistryData.ts}.
 * Run `pnpm --filter web generate:denali-wizard` after registry edits.
 */

import type { DenaliRuleModel } from "./denaliRuleModel.types";

export {
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
  DENALI_RULE_MODEL_VERSION,
  type DenaliRuleFieldDefinition,
  type DenaliRuleFieldStep,
  type DenaliRuleModel,
  type DenaliRuleModelCategory,
  type DenaliRuleModelDuration,
  type DenaliRuleModelKey,
  type DenaliRuleSet,
} from "./denaliRuleModel.types";

export { denaliRuleSet, denaliRuleModelMountainMultiDay } from "./generated/denaliRuleSet.generated";

import { denaliRuleSet } from "./generated/denaliRuleSet.generated";
import {
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
  type DenaliRuleFieldDefinition,
  type DenaliRuleModel as DenaliRuleModelType,
} from "./denaliRuleModel.types";

/** Single field row for `path` (models enforce unique paths at load). */
export function findDenaliRuleField(
  model: DenaliRuleModelType,
  path: string,
): DenaliRuleFieldDefinition | undefined {
  return model.fields.find((field) => field.path === path);
}

/** Unique canonical field paths across every category × duration in a rule set. */
export function listDenaliRuleFieldPaths(
  ruleSet: import("./denaliRuleModel.types").DenaliRuleSet = denaliRuleSet,
): readonly string[] {
  const paths = new Set<string>();
  for (const category of DENALI_RULE_MODEL_CATEGORIES) {
    for (const duration of DENALI_RULE_MODEL_DURATIONS) {
      const model = ruleSet[category][duration];
      if (model == null) {
        continue;
      }
      for (const field of model.fields) {
        paths.add(field.path);
      }
    }
  }
  return [...paths].sort();
}

/** Rejects duplicate `path` rows — there is no runtime “last rule wins” merge. */
export function assertUniqueDenaliFieldPaths(model: DenaliRuleModel): void {
  const seen = new Set<string>();
  for (const field of model.fields) {
    if (seen.has(field.path)) {
      throw new Error(
        `denaliRuleSet ${model.category}/${model.duration}: duplicate field path "${field.path}"`,
      );
    }
    seen.add(field.path);
  }
}

for (const category of DENALI_RULE_MODEL_CATEGORIES) {
  for (const duration of DENALI_RULE_MODEL_DURATIONS) {
    const model = denaliRuleSet[category][duration];
    if (model != null) {
      assertUniqueDenaliFieldPaths(model);
    }
  }
}
