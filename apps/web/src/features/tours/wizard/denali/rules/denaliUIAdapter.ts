import { denaliTourKindToIsMultiDay, type DenaliTourKind, type TourFormProfile } from "@repo/types";
import type { DenaliCanonicalTourModel } from "@repo/types/denali";
import {
  isDenaliAdminCapacityApprovalVisible,
  isDenaliAllowPersonalCarVisible,
  isDenaliSeatPreferenceRequired,
  isDenaliTransportCostVisible,
  isDenaliTransportDongAmountRequired,
  isDenaliTransportDongAmountVisible,
  type DenaliCanonicalTransportMode,
} from "@repo/types/denali";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { readDenaliCanonicalBasics } from "../denaliCanonicalBasicsControl";
import { getDenaliFormPathValue } from "../denaliFormPathUtils";
import {
  DENALI_FIELD_DEFINITIONS,
  type DenaliFieldDefinition,
} from "../registry/denaliFieldRegistryData";
import type { DenaliContextualRule } from "../registry/DenaliFieldRegistry.types";
import { getDenaliRulesFromCanonical } from "./denaliCanonicalRuleAdapter";
import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "./generated/denaliCanonicalPathMap.generated";
import { isDenaliFieldRequired, mapFormPathToCanonical } from "./denaliRuleRequired";
import type {
  DenaliRuleFieldDefinition,
  DenaliRuleFieldStep,
  DenaliRuleModel,
  DenaliRuleModelCategory,
  DenaliRuleModelDuration,
  DenaliRuleSet,
} from "./denaliRuleModel";
import { denaliRuleSet, findDenaliRuleField } from "./denaliRuleModel";

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
  stepUI: (step: DenaliRuleFieldStep | DenaliCreateWizardStepId) => DenaliUIFieldMetadata | null;
  isVisible: (
    step: DenaliRuleFieldStep | DenaliCreateWizardStepId,
    path: string,
    form?: DenaliCreateTourWizardForm,
  ) => boolean;
  isRequired: (
    step: DenaliRuleFieldStep | DenaliCreateWizardStepId,
    path: string,
    form?: DenaliCreateTourWizardForm,
  ) => boolean;
  arePathsVisible: (
    step: DenaliRuleFieldStep | DenaliCreateWizardStepId,
    paths: readonly string[],
    form?: DenaliCreateTourWizardForm,
  ) => boolean;
  isVisibleInModel: (path: string, form?: DenaliCreateTourWizardForm) => boolean;
  isRequiredInModel: (path: string, form?: DenaliCreateTourWizardForm) => boolean;
  isDurationAllowed: (duration: DenaliRuleModelDuration) => boolean;
};

export type DenaliUIFieldMetadata = {
  readonly visibleFields: readonly string[];
  readonly hiddenFields: readonly string[];
  readonly requiredFields: readonly string[];
};

/** @deprecated Theme no longer drives form visibility; kept for call-site compat. */
export type DenaliUIContextOptions = {
  mainThemeFormProfile?: TourFormProfile;
};

export type DenaliUIAdapterInput = {
  step: DenaliRuleFieldStep | DenaliCreateWizardStepId;
  category: DenaliRuleModelCategory;
  duration: DenaliRuleModelDuration;
  ruleSet?: DenaliRuleSet;
};

const DEFINITION_BY_CANONICAL_PATH = new Map<string, DenaliFieldDefinition>(
  DENALI_FIELD_DEFINITIONS.map((def) => [def.canonicalPath, def]),
);

export function getDenaliFieldDefinitionByCanonicalPath(
  canonicalPath: string,
): DenaliFieldDefinition | undefined {
  return DEFINITION_BY_CANONICAL_PATH.get(canonicalPath);
}

function readCanonicalPathValue(form: DenaliCreateTourWizardForm, watchCanonical: string): unknown {
  const formPath = DENALI_CANONICAL_TO_FORM_PATH_MAP[watchCanonical] ?? watchCanonical;
  return getDenaliFormPathValue(form, formPath);
}

function isTruthyFormValue(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

function transportModeFromForm(form: DenaliCreateTourWizardForm): DenaliCanonicalTransportMode {
  return form.transport.transportMode as DenaliCanonicalTransportMode;
}

function transportPersonalCarInput(form: DenaliCreateTourWizardForm): {
  mode: DenaliCanonicalTransportMode;
  allowPersonalCar?: boolean;
} {
  return {
    mode: transportModeFromForm(form),
    allowPersonalCar: form.transport.allowPersonalCar,
  };
}

/** Maps registry `contextualVisibility` / `contextualRequired` kinds to `@repo/types/denali` predicates. */
export function evaluateDenaliContextualRule(
  rule: DenaliContextualRule,
  form: DenaliCreateTourWizardForm,
  mode: "visibility" | "required",
): boolean {
  switch (rule.kind) {
    case "whenTruthy":
      return isTruthyFormValue(readCanonicalPathValue(form, rule.watchCanonical));
    case "transportOrganizedCostVisible":
      return isDenaliTransportCostVisible(transportModeFromForm(form));
    case "transportPersonalCarOptionVisible":
      return isDenaliAllowPersonalCarVisible(transportModeFromForm(form));
    case "transportDongVisible":
      return mode === "required"
        ? isDenaliTransportDongAmountRequired(transportPersonalCarInput(form))
        : isDenaliTransportDongAmountVisible(transportPersonalCarInput(form));
    case "transportAdminCapacityVisible":
      return isDenaliAdminCapacityApprovalVisible(transportPersonalCarInput(form));
    case "transportTrainSeatVisible":
      return isDenaliSeatPreferenceRequired(transportModeFromForm(form));
    case "multiDayEndDateTimeRequired":
      return denaliTourKindToIsMultiDay(form.basicInfo.tourType as DenaliTourKind);
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

export function evaluateDenaliContextualVisibility(
  canonicalPath: string,
  form: DenaliCreateTourWizardForm | undefined,
): boolean {
  if (form == null) return true;
  const def = getDenaliFieldDefinitionByCanonicalPath(canonicalPath);
  if (def?.contextualVisibility == null) return true;
  return evaluateDenaliContextualRule(def.contextualVisibility, form, "visibility");
}

export function evaluateDenaliContextualRequired(
  canonicalPath: string,
  form: DenaliCreateTourWizardForm,
): boolean | null {
  const def = getDenaliFieldDefinitionByCanonicalPath(canonicalPath);
  if (def?.contextualRequired == null) return null;
  return evaluateDenaliContextualRule(def.contextualRequired, form, "required");
}

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

function isDenaliFieldContextuallyVisible(
  path: string,
  form: DenaliCreateTourWizardForm | undefined,
  _options?: DenaliUIContextOptions,
): boolean {
  return evaluateDenaliContextualVisibility(path, form);
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
  if (!isDenaliFieldContextuallyVisible(canonicalPath, form, options)) return false;

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

/** Category-wide visibility (ignores `field.step`). */
export function isDenaliFieldVisibleInModel(
  model: DenaliRuleModel | null,
  path: string,
  form?: DenaliCreateTourWizardForm,
  options?: DenaliUIContextOptions,
): boolean {
  if (model == null) return false;
  const canonicalPath = mapFormPathToCanonical(path);
  if (!isDenaliFieldContextuallyVisible(canonicalPath, form, options)) return false;
  const field = findDenaliRuleField(model, canonicalPath);
  if (field == null) {
    const registryOnly = getDenaliFieldDefinitionByCanonicalPath(canonicalPath);
    return registryOnly?.contextualVisibility != null;
  }
  return !field.hidden;
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
