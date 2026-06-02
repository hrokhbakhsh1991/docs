import type { DenaliTourKind } from "@repo/types";
import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { readDenaliCanonicalBasics } from "../domain/canonical-basics";
import {
  denaliRuleSet,
  evaluateDenaliContextualVisibility,
  findDenaliRuleField,
  getDenaliFieldDefinitionByCanonicalPath,
  getDenaliRulesFromCanonical,
  isDenaliFieldRequired,
  isDenaliFieldVisibleInModel,
  mapFormPathToCanonical,
  type DenaliRuleFieldDefinition,
  type DenaliRuleFieldStep,
  type DenaliRuleModel,
  type DenaliRuleModelCategory,
  type DenaliRuleModelDuration,
  type DenaliRuleSet,
  type DenaliUIContextOptions,
} from "./core";

/**
 * Denali rule engine — UI visibility and required state only.
 *
 * Public API: {@link isDenaliFieldVisibleOnStep}, {@link isDenaliFieldRequiredOnStep},
 * {@link isDenaliFieldVisibleInModel}, {@link isDenaliFieldRequiredInModel} (aliases: {@link isVisible}, {@link isRequired}).
 * Validation: {@link ../validation/denaliWizardFormZod.ts}.
 */
export type DenaliCanonicalUIContext = {
  readonly canonical: Pick<DenaliCanonicalTourModel, "category" | "duration">;
  readonly ruleModel: DenaliRuleModel | null;
  stepUI: (_step: DenaliRuleFieldStep | DenaliCreateWizardStepId) => DenaliUIFieldMetadata | null;
  isVisible: (
    _step: DenaliRuleFieldStep | DenaliCreateWizardStepId,
    _path: string,
    _form?: DenaliCreateTourWizardForm,
  ) => boolean;
  isRequired: (
    _step: DenaliRuleFieldStep | DenaliCreateWizardStepId,
    _path: string,
    _form?: DenaliCreateTourWizardForm,
  ) => boolean;
  arePathsVisible: (
    _step: DenaliRuleFieldStep | DenaliCreateWizardStepId,
    _paths: readonly string[],
    _form?: DenaliCreateTourWizardForm,
  ) => boolean;
  isVisibleInModel: (_path: string, _form?: DenaliCreateTourWizardForm) => boolean;
  isRequiredInModel: (_path: string, _form?: DenaliCreateTourWizardForm) => boolean;
  isDurationAllowed: (_duration: DenaliRuleModelDuration) => boolean;
};

export type DenaliUIFieldMetadata = {
  readonly visibleFields: readonly string[];
  readonly hiddenFields: readonly string[];
  readonly requiredFields: readonly string[];
};

export type { DenaliUIContextOptions } from "./denaliContextualRules";

export type DenaliUIAdapterInput = {
  step: DenaliRuleFieldStep | DenaliCreateWizardStepId;
  category: DenaliRuleModelCategory;
  duration: DenaliRuleModelDuration;
  ruleSet?: DenaliRuleSet;
};

export {
  evaluateDenaliContextualRequired,
  evaluateDenaliContextualRule,
  evaluateDenaliContextualVisibility,
  getDenaliFieldDefinitionByCanonicalPath,
} from "./denaliContextualRules";
export { isDenaliFieldRequired, isDenaliFieldVisibleInModel } from "./denaliFieldGate";

function resolveDenaliRuleModel(
  category: DenaliRuleModelCategory,
  duration: DenaliRuleModelDuration,
  ruleSet: DenaliRuleSet,
): DenaliRuleModel | null {
  return ruleSet[category][duration];
}

function fieldsForStep(
  model: DenaliRuleModel,
  step: DenaliRuleFieldStep | DenaliCreateWizardStepId,
): readonly DenaliRuleFieldDefinition[] {
  if (step === "review") {
    return model.fields;
  }
  return model.fields.filter((field) => field.step === step);
}

/** Derive visible / hidden / required path lists for one wizard step from {@link DenaliRuleModel}. */
export function deriveDenaliUIFieldMetadata(
  model: DenaliRuleModel,
  step: DenaliRuleFieldStep | DenaliCreateWizardStepId,
): DenaliUIFieldMetadata {
  const scoped = fieldsForStep(model, step);

  const hiddenFields = scoped.filter((field) => field.hidden).map((field) => field.path);
  const visibleFields = scoped.filter((field) => !field.hidden).map((field) => field.path);
  const requiredFields = scoped
    .filter((field) => field.required && !field.hidden)
    .map((field) => field.path);

  return { visibleFields, hiddenFields, requiredFields };
}

export function visibleFields(
  step: DenaliUIAdapterInput["step"],
  category: DenaliRuleModelCategory,
  duration: DenaliRuleModelDuration,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): readonly string[] {
  const model = resolveDenaliRuleModel(category, duration, ruleSet);
  if (model == null) return [];
  return deriveDenaliUIFieldMetadata(model, step).visibleFields;
}

export function hiddenFields(
  step: DenaliUIAdapterInput["step"],
  category: DenaliRuleModelCategory,
  duration: DenaliRuleModelDuration,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): readonly string[] {
  const model = resolveDenaliRuleModel(category, duration, ruleSet);
  if (model == null) return [];
  return deriveDenaliUIFieldMetadata(model, step).hiddenFields;
}

export function requiredFields(
  step: DenaliUIAdapterInput["step"],
  category: DenaliRuleModelCategory,
  duration: DenaliRuleModelDuration,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): readonly string[] {
  const model = resolveDenaliRuleModel(category, duration, ruleSet);
  if (model == null) return [];
  return deriveDenaliUIFieldMetadata(model, step).requiredFields;
}

/** Full metadata bundle for one step (convenience for hooks / tests). */
export function getDenaliUIAdapterMetadata(input: DenaliUIAdapterInput): DenaliUIFieldMetadata | null {
  const ruleSet = input.ruleSet ?? denaliRuleSet;
  const model = resolveDenaliRuleModel(input.category, input.duration, ruleSet);
  if (model == null) return null;
  return deriveDenaliUIFieldMetadata(model, input.step);
}

export function isDenaliDurationAllowed(
  category: DenaliRuleModelCategory,
  duration: DenaliRuleModelDuration,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): boolean {
  return resolveDenaliRuleModel(category, duration, ruleSet) != null;
}

/**
 * Whether `path` is visible on `step` for the current rule model and form state.
 */
export function isDenaliFieldVisibleOnStep(
  model: DenaliRuleModel | null,
  step: DenaliRuleFieldStep | DenaliCreateWizardStepId,
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
    if (registryOnly?.contextualVisibility == null) return false;
    if (step === "review") return true;
    return registryOnly.stepId === step;
  }
  if (field.hidden) return false;
  if (step === "review") return true;
  return field.step === step;
}

export function isDenaliFieldRequiredOnStep(
  model: DenaliRuleModel | null,
  step: DenaliRuleFieldStep | DenaliCreateWizardStepId,
  path: string,
  form?: DenaliCreateTourWizardForm,
  options?: DenaliUIContextOptions,
): boolean {
  if (model == null) return false;
  const canonicalPath = mapFormPathToCanonical(path);

  const field = findDenaliRuleField(model, canonicalPath);
  if (field == null) {
    const registryOnly = getDenaliFieldDefinitionByCanonicalPath(canonicalPath);
    if (registryOnly?.contextualRequired == null) return false;
    if (step !== "review" && registryOnly.stepId !== step) return false;
    if (form != null) {
      return isDenaliFieldRequired(model, canonicalPath, form, options);
    }
    return false;
  }
  if (field.hidden) return false;
  if (step !== "review" && field.step !== step) return false;
  if (form != null) {
    return isDenaliFieldRequired(model, canonicalPath, form, options);
  }
  return field.required;
}

/** True when every path in `paths` is visible on `step` (e.g. outdoor program block). */
export function areDenaliFieldPathsVisibleOnStep(
  model: DenaliRuleModel | null,
  step: DenaliRuleFieldStep | DenaliCreateWizardStepId,
  paths: readonly string[],
  form?: DenaliCreateTourWizardForm,
  options?: DenaliUIContextOptions,
): boolean {
  return paths.every((path) => isDenaliFieldVisibleOnStep(model, step, path, form, options));
}

export function isDenaliFieldRequiredInModel(
  model: DenaliRuleModel | null,
  path: string,
  form?: DenaliCreateTourWizardForm,
  options?: DenaliUIContextOptions,
): boolean {
  if (model == null) return false;
  const canonicalPath = mapFormPathToCanonical(path);
  if (form != null) {
    return isDenaliFieldRequired(model, canonicalPath, form, options);
  }
  const field = findDenaliRuleField(model, canonicalPath);
  return field != null && field.required && !field.hidden;
}

/** Unique hidden paths for a resolved rule model (normalize / clone hygiene). */
export function getHiddenFieldPathsFromModel(model: DenaliRuleModel): readonly string[] {
  return [...new Set(model.fields.filter((field) => field.hidden).map((field) => field.path))];
}

/** Rule engine: field visible on step (or whole form on `review`). */
export const isVisible = isDenaliFieldVisibleOnStep;

/** Rule engine: field required on step (or whole form on `review`). */
export const isRequired = isDenaliFieldRequiredOnStep;

function buildDenaliUIContext(
  ruleModel: DenaliRuleModel | null,
  classification: Pick<DenaliCanonicalTourModel, "category" | "duration">,
  ruleSet: DenaliRuleSet,
  form?: DenaliCreateTourWizardForm,
  options?: DenaliUIContextOptions,
): DenaliCanonicalUIContext {
  return {
    canonical: classification,
    ruleModel,
    stepUI: (step) =>
      ruleModel == null ? null : deriveDenaliUIFieldMetadata(ruleModel, step),
    isVisible: (step, path, f) =>
      isDenaliFieldVisibleOnStep(ruleModel, step, path, f ?? form, options),
    isRequired: (step, path, f) =>
      isDenaliFieldRequiredOnStep(ruleModel, step, path, f ?? form, options),
    arePathsVisible: (step, paths, f) =>
      areDenaliFieldPathsVisibleOnStep(ruleModel, step, paths, f ?? form, options),
    isVisibleInModel: (path, f) => isDenaliFieldVisibleInModel(ruleModel, path, f ?? form, options),
    isRequiredInModel: (path, f) => isDenaliFieldRequiredInModel(ruleModel, path, f ?? form, options),
    isDurationAllowed: (duration) =>
      isDenaliDurationAllowed(classification.category, duration, ruleSet),
  };
}

export function getDenaliUIFromCanonical(
  canonical: DenaliCanonicalTourModel,
  ruleSet: DenaliRuleSet = denaliRuleSet,
  form?: DenaliCreateTourWizardForm,
  options?: DenaliUIContextOptions,
): DenaliCanonicalUIContext {
  const ruleModel = getDenaliRulesFromCanonical(canonical, ruleSet);
  return buildDenaliUIContext(
    ruleModel,
    { category: canonical.category, duration: canonical.duration },
    ruleSet,
    form,
    options,
  );
}

/** UI rules resolved from `basicInfo.tourType` (authoritative classification). */
export function getDenaliUIFromForm(
  form: DenaliCreateTourWizardForm,
  ruleSet: DenaliRuleSet = denaliRuleSet,
  options?: DenaliUIContextOptions,
): DenaliCanonicalUIContext {
  const basics = readDenaliCanonicalBasics(form.basicInfo.tourType as DenaliTourKind | undefined);
  const ruleModel =
    basics == null ? null : ruleSet[basics.category][basics.duration];
  const category = basics?.category ?? "mountain";
  const duration = basics?.duration === "multi_day" ? "multi" : "single";
  return buildDenaliUIContext(ruleModel, { category, duration }, ruleSet, form, options);
}
