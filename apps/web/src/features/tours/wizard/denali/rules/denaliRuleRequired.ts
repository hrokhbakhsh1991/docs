// DEPRECATED: DO NOT EDIT CANONICAL_TO_FORM_PATH_MAP here — AUTO-GENERATED from the registry.
// Edit denaliFieldRegistryData.ts, then: pnpm --filter web generate:denali-wizard
/**
 * Rule-engine required resolution (visibility + product required flags).
 *
 * Conditional required (transport dong, paid price, multi-day end) lives here — not in Zod.
 */

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { evaluateDenaliContextualRequired } from "./denaliUIAdapter";
import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "./generated/denaliCanonicalPathMap.generated";
import { DENALI_CONDITIONALLY_REQUIRED_CANONICAL_PATHS } from "./generated/denaliConditionallyRequiredPaths.generated";
import type { DenaliRuleFieldStep, DenaliRuleModel } from "./denaliRuleModel.types";
import { findDenaliRuleField, listDenaliRuleFieldPaths } from "./denaliRuleModel";
import { getDenaliFormPathValue, setDenaliFormPathValue } from "../denaliFormPathUtils";
import { patchDenaliCanonicalBasics, readDenaliCanonicalBasics } from "../denaliCanonicalBasicsControl";
import type { DenaliTourKind } from "@repo/types";
import { isDenaliFieldVisibleInModel, type DenaliUIContextOptions } from "./denaliUIAdapter";

/** Submit gate: all steps. Step gate: one rail step only (field.step === stepId). */
export type DenaliRuleValidationScope =
  | { mode: "submit" }
  | { mode: "step"; stepId: DenaliCreateWizardStepId };

/** Contextual required paths (canonical; generated from registry `contextualRequired`). */
const CONDITIONALLY_REQUIRED_PATHS = DENALI_CONDITIONALLY_REQUIRED_CANONICAL_PATHS;

export type DenaliRuleRequiredIssue = {
  code: "custom";
  path: (string | number)[];
  message: string;
};

/** Canonical paths eligible for normalize/clear (union of all rule-model fields). */
export const DENALI_WIZARD_CANONICAL_FIELD_PATHS = new Set(listDenaliRuleFieldPaths());

/** @deprecated Use {@link DENALI_WIZARD_CANONICAL_FIELD_PATHS} */
export const DENALI_WIZARD_FORM_FIELD_PATHS = DENALI_WIZARD_CANONICAL_FIELD_PATHS;

export function mapDenaliCanonicalToFormPath(path: string): string {
  return DENALI_CANONICAL_TO_FORM_PATH_MAP[path] ?? path;
}

const FORM_TO_CANONICAL_PATH: Record<string, string> = Object.fromEntries(
  Object.entries(DENALI_CANONICAL_TO_FORM_PATH_MAP).map(([canonical, formPath]) => [
    formPath,
    canonical,
  ]),
);

/** RHF dot path → canonical rule path (for UI + step validation). */
export function mapFormPathToCanonical(path: string): string {
  return FORM_TO_CANONICAL_PATH[path] ?? path;
}

function isEmptyRequiredValue(value: unknown, path: string): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "boolean") return value !== true;
  if (Array.isArray(value)) return value.length === 0;
  
  const formPath = mapDenaliCanonicalToFormPath(path);
  if (
    (formPath === "transport.transportCost" ||
      formPath === "transport.dongAmount" ||
      formPath === "pricingPayment.basePricePerPerson" ||
      formPath === "basicInfo.capacityMax" ||
      formPath === "programNature.altitudeMeasurement") &&
    typeof value === "number"
  ) {
    return !Number.isFinite(value) || value <= 0;
  }
  return false;
}

function collectDenaliItineraryRequiredIssues(
  form: DenaliCreateTourWizardForm,
  model: DenaliRuleModel,
  scope: DenaliRuleValidationScope,
  uiOptions?: DenaliUIContextOptions,
): DenaliRuleRequiredIssue[] {
  const path = "program.itinerary";
  if (!isDenaliFieldRequired(model, path, form, uiOptions)) return [];
  if (scope.mode === "step" && scope.stepId !== "denali_program") return [];

  const rows = readDenaliFormFieldValue(form, path);
  if (!Array.isArray(rows) || rows.length === 0) {
    return [
      {
        code: "custom",
        path: ["programNature", "itinerary"],
        message: "برنامه روزانه برای تور چندروزه الزامی است.",
      },
    ];
  }

  const issues: DenaliRuleRequiredIssue[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] as { activities?: string };
    if (typeof row?.activities !== "string" || row.activities.trim() === "") {
      issues.push({
        code: "custom",
        path: ["programNature", "itinerary", i, "activities"],
        message: "حداقل یک فعالیت برای هر روز الزامی است.",
      });
    }
  }
  return issues;
}

/**
 * Whether `path` (canonical) is required for the current form state (after visibility).
 * Static flags come from {@link DenaliRuleModel}; dong / price / multi-day end are contextual.
 */
export function isDenaliFieldRequired(
  model: DenaliRuleModel | null,
  path: string,
  form: DenaliCreateTourWizardForm,
  uiOptions?: DenaliUIContextOptions,
): boolean {
  if (!isDenaliFieldVisibleInModel(model, path, form, uiOptions)) {
    return false;
  }

  const contextualRequired = evaluateDenaliContextualRequired(path, form);
  if (contextualRequired != null) {
    return contextualRequired;
  }

  const field = model == null ? undefined : findDenaliRuleField(model, path);
  return field != null && field.required && !field.hidden;
}

export function readDenaliFormFieldValue(
  form: DenaliCreateTourWizardForm,
  path: string,
): unknown {
  if (path === "eventVariant") {
    return readDenaliCanonicalBasics(form.basicInfo.tourType as DenaliTourKind | undefined)
      ?.eventVariant;
  }
  return getDenaliFormPathValue(form, mapDenaliCanonicalToFormPath(path));
}

/** Test/helper: write a canonical path on the wizard form (mirrors {@link readDenaliFormFieldValue}). */
export function writeDenaliFormFieldValue(
  form: DenaliCreateTourWizardForm,
  path: string,
  value: unknown,
): void {
  if (path === "eventVariant") {
    form.basicInfo = {
      ...form.basicInfo,
      tourType: patchDenaliCanonicalBasics(form.basicInfo.tourType, {
        eventVariant: value as "reading" | "cinema" | undefined,
      }),
    };
    return;
  }
  setDenaliFormPathValue(form, mapDenaliCanonicalToFormPath(path), value);
}

function fieldMatchesValidationScope(
  fieldStep: DenaliRuleFieldStep,
  scope: DenaliRuleValidationScope,
): boolean {
  if (scope.mode === "submit") {
    return true;
  }
  return fieldStep === scope.stepId;
}

function pushRequiredIssueIfEmpty(
  issues: DenaliRuleRequiredIssue[],
  seen: Set<string>,
  form: DenaliCreateTourWizardForm,
  model: DenaliRuleModel,
  path: string,
  uiOptions?: DenaliUIContextOptions,
): void {
  if (seen.has(path)) return;
  if (!DENALI_WIZARD_CANONICAL_FIELD_PATHS.has(path)) return;
  if (!isDenaliFieldRequired(model, path, form, uiOptions)) return;
  const value = readDenaliFormFieldValue(form, path);
  if (!isEmptyRequiredValue(value, path)) return;
  seen.add(path);
  issues.push({
    code: "custom",
    path: mapDenaliCanonicalToFormPath(path).split("."),
    message: "این فیلد الزامی است.",
  });
}

/** Issues for empty required fields (rule engine authority). */
export function collectDenaliRuleRequiredIssues(
  form: DenaliCreateTourWizardForm,
  model: DenaliRuleModel,
  scope: DenaliRuleValidationScope = { mode: "submit" },
  uiOptions?: DenaliUIContextOptions,
): DenaliRuleRequiredIssue[] {
  const issues: DenaliRuleRequiredIssue[] = [];
  const seen = new Set<string>();

  for (const field of model.fields) {
    if (field.hidden) continue;
    if (!fieldMatchesValidationScope(field.step, scope)) continue;
    pushRequiredIssueIfEmpty(issues, seen, form, model, field.path, uiOptions);
  }

  if (scope.mode === "submit") {
    for (const path of CONDITIONALLY_REQUIRED_PATHS) {
      // Note: CONDITIONALLY_REQUIRED_PATHS should also be canonical if we want consistency,
      // but let's see what they contain.
      pushRequiredIssueIfEmpty(issues, seen, form, model, path, uiOptions);
    }
  }

  for (const issue of collectDenaliItineraryRequiredIssues(form, model, scope, uiOptions)) {
    const key = issue.path.join(".");
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(issue);
  }

  return issues;
}
