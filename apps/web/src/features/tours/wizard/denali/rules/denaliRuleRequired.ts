/**
 * Rule-engine required resolution (visibility + product required flags).
 *
 * Conditional required (transport dong, paid price, multi-day end) lives here — not in Zod.
 */

import { denaliTourKindToIsMultiDay } from "@repo/types";
import {
  isDenaliTransportDongAmountRequired,
} from "@repo/types/denali";

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import type { DenaliRuleFieldStep, DenaliRuleModel } from "./denaliRuleModel";
import { findDenaliRuleField } from "./denaliRuleModel";
import { isDenaliFieldVisibleInModel, type DenaliUIContextOptions } from "./denaliUIAdapter";

/** Submit gate: all steps. Step gate: one rail step only (field.step === stepId). */
export type DenaliRuleValidationScope =
  | { mode: "submit" }
  | { mode: "step"; stepId: DenaliCreateWizardStepId };

/** Contextual required paths (canonical; also declared on the rule model with `required: false`). */
const CONDITIONALLY_REQUIRED_PATHS = [
  "endDateTime",
  "transport.dongAmount",
  "pricing.basePricePerPerson",
  "program.altitudeMeasurement",
] as const;

export type DenaliRuleRequiredIssue = {
  code: "custom";
  path: (string | number)[];
  message: string;
};

/** Legacy RHF paths that exist on {@link denaliTourCreateBaseSchema}. */
export const DENALI_WIZARD_CANONICAL_FIELD_PATHS = new Set([
  "title",
  "category",
  "destinationId",
  "startDateTime",
  "endDateTime",
  "capacityMin",
  "capacityMax",
  "meetingPoint",
  "leaderUserIds",
  "requiresLocalGuide",
  "localGuideName",
  "program.themeIds",
  "program.shortDescription",
  "program.longDescription",
  "program.difficultyLevel",
  "program.hikingHoursApprox",
  "program.altitudeMeasurement",
  "program.itinerary",
  "gatheringPoints",
  "transport.mode",
  "transport.transportCost",
  "transport.allowPersonalCar",
  "transport.dongAmount",
  "transport.transportNotes",
  "pricing.requiresPayment",
  "pricing.basePricePerPerson",
  "pricing.paymentMode",
  "pricing.includesTourInsurance",
  "socialMediaLink",
  "publishStatus",
  "requiresManualAdminApproval",
  "participants.nationalIdRequired",
  "policies.cancellationDeadlineHours",
  "policies.cancellationPenaltyPercentage",
  "participants.minimumAge",
  "participants.maximumAge",
  "participants.fitnessLevel",
  "participants.sportsInsuranceRequired",
  "participants.gearItems",
  "policies.policiesText",
  "photos",
]);

/** @deprecated Use {@link DENALI_WIZARD_CANONICAL_FIELD_PATHS} */
export const DENALI_WIZARD_FORM_FIELD_PATHS = DENALI_WIZARD_CANONICAL_FIELD_PATHS;

const CANONICAL_TO_FORM_PATH_MAP: Record<string, string> = {
  title: "basicInfo.title",
  category: "basicInfo.tourType",
  destinationId: "basicInfo.destinationId",
  startDateTime: "basicInfo.startDateTime",
  endDateTime: "basicInfo.endDateTime",
  capacityMin: "basicInfo.capacityMin",
  capacityMax: "basicInfo.capacityMax",
  meetingPoint: "basicInfo.meetingPoint",
  leaderUserIds: "basicInfo.leaderUserIds",
  requiresLocalGuide: "basicInfo.requiresLocalGuide",
  localGuideName: "basicInfo.localGuideName",
  startPointLocationText: "basicInfo.startPointLocationText",
  socialMediaLink: "basicInfo.socialMediaLink",
  approximateReturnTime: "basicInfo.approximateReturnTime",
  "program.themeIds": "programNature.themeIds",
  "program.shortDescription": "programNature.shortDescription",
  "program.longDescription": "programNature.longDescription",
  "program.difficultyLevel": "programNature.difficultyLevel",
  "program.hikingHoursApprox": "programNature.hikingHoursApprox",
  "program.hikingGoHours": "programNature.hikingGoHours",
  "program.hikingReturnHours": "programNature.hikingReturnHours",
  "program.altitudeMeasurement": "programNature.altitudeMeasurement",
  "program.itinerary": "programNature.itinerary",
  gatheringPoints: "tripDetails.logistics.gatheringPoints",
  "transport.mode": "transport.transportMode",
  "transport.transportCost": "transport.transportCost",
  "transport.allowPersonalCar": "transport.allowPersonalCar",
  "transport.dongAmount": "transport.dongAmount",
  "transport.transportNotes": "transport.transportNotes",
  "pricing.requiresPayment": "pricingPayment.requiresPayment",
  "pricing.basePricePerPerson": "pricingPayment.basePricePerPerson",
  "pricing.paymentMode": "pricingPayment.paymentMode",
  "pricing.includesTourInsurance": "pricingPayment.includesTourInsurance",
  publishStatus: "basicInfo.publishStatus",
  requiresManualAdminApproval: "basicInfo.requiresManualAdminApproval",
  "participants.nationalIdRequired": "participantRequirements.nationalIdRequired",
  "policies.cancellationDeadlineHours": "policies.cancellationDeadlineHours",
  "policies.cancellationPenaltyPercentage": "policies.cancellationPenaltyPercentage",
  "participants.minimumAge": "participantRequirements.minimumAge",
  "participants.maximumAge": "participantRequirements.maximumAge",
  "participants.fitnessLevel": "participantRequirements.fitnessLevel",
  "participants.sportsInsuranceRequired": "participantRequirements.sportsInsuranceRequired",
  "participants.fitnessPrerequisiteText": "participantRequirements.fitnessPrerequisiteText",
  "participants.gearItems": "participantRequirements.gearItems",
  "policies.policiesText": "policies.policiesText",
  photos: "photosData.photos",
};

export function mapDenaliCanonicalToFormPath(path: string): string {
  return CANONICAL_TO_FORM_PATH_MAP[path] ?? path;
}

const FORM_TO_CANONICAL_PATH: Record<string, string> = Object.fromEntries(
  Object.entries(CANONICAL_TO_FORM_PATH_MAP).map(([canonical, formPath]) => [formPath, canonical]),
);

/** RHF dot path → canonical rule path (for UI + step validation). */
export function mapFormPathToCanonical(path: string): string {
  return FORM_TO_CANONICAL_PATH[path] ?? path;
}

function isEmptyRequiredValue(value: unknown, path: string): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "boolean") return value !== true;
  
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

  const formPath = mapDenaliCanonicalToFormPath(path);

  if (formPath === "transport.dongAmount") {
    return isDenaliTransportDongAmountRequired({
      mode: form.transport.transportMode,
      allowPersonalCar: form.transport.allowPersonalCar,
    });
  }
  if (formPath === "pricingPayment.basePricePerPerson") {
    return form.pricingPayment.requiresPayment === true;
  }
  if (formPath === "basicInfo.endDateTime") {
    return denaliTourKindToIsMultiDay(form.basicInfo.tourType);
  }

  const field = model == null ? undefined : findDenaliRuleField(model, path);
  return field != null && field.required && !field.hidden;
}

export function readDenaliFormFieldValue(
  form: DenaliCreateTourWizardForm,
  path: string,
): unknown {
  const formPath = mapDenaliCanonicalToFormPath(path);
  const [section, leaf] = formPath.split(".") as [keyof DenaliCreateTourWizardForm, string];
  const slice = form[section];
  if (slice == null || typeof slice !== "object") return undefined;
  return (slice as Record<string, unknown>)[leaf];
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
