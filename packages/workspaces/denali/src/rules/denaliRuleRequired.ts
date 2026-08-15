/**
 * Rule-engine required resolution (visibility + product required flags).
 *
 * Conditional required (transport dong, paid price, multi-day end) lives here — not in Zod.
 */

import type { DenaliCreateWizardStepId } from "../layout/stepIds";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import type { DenaliTourKind } from "../types/legacy/repo-types";
import { getDenaliFormPathValue, setDenaliFormPathValue } from "../adapters/denaliFormPathUtils";
import {
  patchDenaliCanonicalBasics,
  readDenaliCanonicalBasics,
} from "../adapters/denaliCanonicalBasicsControl";

import {
  collectDenaliItineraryDayValidationIssues,
  parseDenaliItineraryDays,
} from "../schemas/denaliItineraryDaySchema";

import { mapDenaliCanonicalToFormPath } from "./denaliCanonicalPaths";
import type { DenaliUIContextOptions } from "./denaliContextualRules";
import { isDenaliFieldRequired } from "./denaliFieldGate";
import { DENALI_CONDITIONALLY_REQUIRED_CANONICAL_PATHS } from "./generated/denaliConditionallyRequiredPaths.generated";
import { findDenaliRuleField, listDenaliRuleFieldPaths } from "./denaliRuleModel";
import type { DenaliRuleFieldStep, DenaliRuleModel } from "./denaliRuleModel.types";

/** Submit gate: all steps. Step gate: one rail step only (field.step === stepId). */
export type DenaliRuleValidationScope =
  | { mode: "submit" }
  | { mode: "step"; stepId: DenaliCreateWizardStepId };

const CONDITIONALLY_REQUIRED_PATHS = DENALI_CONDITIONALLY_REQUIRED_CANONICAL_PATHS;

export type DenaliRuleRequiredIssue = {
  code: "custom";
  path: (string | number)[];
  message: string;
};

export const DENALI_WIZARD_CANONICAL_FIELD_PATHS = new Set(listDenaliRuleFieldPaths());

function isEmptyRequiredValue(value: unknown, path: string): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "boolean") return value !== true;
  if (Array.isArray(value)) return value.length === 0;

  const formPath = mapDenaliCanonicalToFormPath(path);
  if (
    (formPath === "transport.transportCost" ||
      formPath === "transport.dongAmount" ||
      formPath === "pricingPayment.prepaymentPercent" ||
      formPath === "pricingPayment.basePricePerPerson" ||
      formPath === "basicInfo.capacityMax" ||
      formPath === "tripDetails.overview.peakHeight") &&
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
  uiOptions?: DenaliUIContextOptions
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

  const days = parseDenaliItineraryDays(rows);
  const issues: DenaliRuleRequiredIssue[] = [];
  for (const issue of collectDenaliItineraryDayValidationIssues(days)) {
    issues.push({
      code: "custom",
      path:
        issue.segmentIndex != null
          ? ["programNature", "itinerary", issue.dayIndex, "segments", issue.segmentIndex, "title"]
          : ["programNature", "itinerary", issue.dayIndex, "title"],
      message: issue.message,
    });
  }
  return issues;
}

export function readDenaliFormFieldValue(
  form: DenaliCreateTourWizardForm,
  path: string
): unknown {
  if (path === "eventVariant") {
    return readDenaliCanonicalBasics(form.basicInfo.tourType as DenaliTourKind | undefined)
      ?.eventVariant;
  }
  return getDenaliFormPathValue(form, mapDenaliCanonicalToFormPath(path));
}

export function writeDenaliFormFieldValue(
  form: DenaliCreateTourWizardForm,
  path: string,
  value: unknown
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
  scope: DenaliRuleValidationScope
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
  uiOptions?: DenaliUIContextOptions
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

export function collectDenaliRuleRequiredIssues(
  form: DenaliCreateTourWizardForm,
  model: DenaliRuleModel,
  scope: DenaliRuleValidationScope = { mode: "submit" },
  uiOptions?: DenaliUIContextOptions
): DenaliRuleRequiredIssue[] {
  const issues: DenaliRuleRequiredIssue[] = [];
  const seen = new Set<string>();

  for (const field of model.fields) {
    if (field.hidden) continue;
    if (!fieldMatchesValidationScope(field.step, scope)) continue;
    pushRequiredIssueIfEmpty(issues, seen, form, model, field.path, uiOptions);
  }

  for (const path of CONDITIONALLY_REQUIRED_PATHS) {
    if (scope.mode === "step") {
      const field = findDenaliRuleField(model, path);
      if (field == null || field.step !== scope.stepId) {
        continue;
      }
    }
    pushRequiredIssueIfEmpty(issues, seen, form, model, path, uiOptions);
  }

  for (const issue of collectDenaliItineraryRequiredIssues(form, model, scope, uiOptions)) {
    const key = issue.path.join(".");
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(issue);
  }

  return issues;
}
