import { denaliTourKindToIsMultiDay, type DenaliTourKind } from "@repo/types";
import {
  isDenaliAdminCapacityApprovalVisible,
  isDenaliAllowPersonalCarVisible,
  isDenaliSeatPreferenceRequired,
  isDenaliTransportCostVisible,
  isDenaliTransportDongAmountRequired,
  isDenaliTransportDongAmountVisible,
  type DenaliCanonicalTransportMode,
} from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { getDenaliFormPathValue } from "../denaliFormPathUtils";
import {
  DENALI_FIELD_DEFINITIONS,
  type DenaliFieldDefinition,
} from "../registry/denaliFieldRegistryData";
import type { DenaliContextualRule } from "../registry/DenaliFieldRegistry.types";
import { getCapabilitiesForProfile } from "@/lib/workspace/workspace-capabilities";
import type { TourFormProfile } from "@repo/types";

import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "./generated/denaliCanonicalPathMap.generated";

export type DenaliUIContextOptions = {
  mainThemeFormProfile?: TourFormProfile;
  workspaceFormProfile?: TourFormProfile;
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

export function evaluateDenaliContextualRule(
  rule: DenaliContextualRule,
  form: DenaliCreateTourWizardForm,
  mode: "visibility" | "required",
  options?: DenaliUIContextOptions,
): boolean {
  switch (rule.kind) {
    case "whenTruthy":
      return isTruthyFormValue(readCanonicalPathValue(form, rule.watchCanonical));
    case "capability": {
      const profile = options?.workspaceFormProfile ?? options?.mainThemeFormProfile;
      if (!profile) {
        return mode === "visibility";
      }
      const capabilities = getCapabilitiesForProfile(profile);
      if (rule.flag === "canDefineCustomServices") {
        return capabilities.canDefineCustomServices;
      }
      return false;
    }
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
  options?: DenaliUIContextOptions,
): boolean {
  if (form == null) return true;
  const def = getDenaliFieldDefinitionByCanonicalPath(canonicalPath);
  if (def?.contextualVisibility == null) return true;
  return evaluateDenaliContextualRule(def.contextualVisibility, form, "visibility", options);
}

export function evaluateDenaliContextualRequired(
  canonicalPath: string,
  form: DenaliCreateTourWizardForm,
  options?: DenaliUIContextOptions,
): boolean | null {
  const def = getDenaliFieldDefinitionByCanonicalPath(canonicalPath);
  if (def?.contextualRequired == null) return null;
  return evaluateDenaliContextualRule(def.contextualRequired, form, "required", options);
}
