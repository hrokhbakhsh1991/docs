import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import {
  evaluateDenaliContextualRequired,
  evaluateDenaliContextualVisibility,
  getDenaliFieldDefinitionByCanonicalPath,
  type DenaliUIContextOptions,
} from "./denaliContextualRules";
import { mapFormPathToCanonical } from "./denaliCanonicalPaths";
import { findDenaliRuleField, type DenaliRuleModel } from "./denaliRuleModel";

export function isDenaliFieldVisibleInModel(
  model: DenaliRuleModel | null,
  path: string,
  form?: DenaliCreateTourWizardForm,
  options?: DenaliUIContextOptions,
): boolean {
  if (model == null) return false;
  const canonicalPath = mapFormPathToCanonical(path);
  if (!evaluateDenaliContextualVisibility(canonicalPath, form, options)) return false;
  const field = findDenaliRuleField(model, canonicalPath);
  if (field == null) {
    const registryOnly = getDenaliFieldDefinitionByCanonicalPath(canonicalPath);
    return registryOnly?.contextualVisibility != null;
  }
  return !field.hidden;
}

export function isDenaliFieldRequired(
  model: DenaliRuleModel | null,
  path: string,
  form: DenaliCreateTourWizardForm,
  uiOptions?: DenaliUIContextOptions,
): boolean {
  if (!isDenaliFieldVisibleInModel(model, path, form, uiOptions)) {
    return false;
  }

  const contextualRequired = evaluateDenaliContextualRequired(path, form, uiOptions);
  if (contextualRequired != null) {
    return contextualRequired;
  }

  const field = model == null ? undefined : findDenaliRuleField(model, path);
  return field != null && field.required && !field.hidden;
}
