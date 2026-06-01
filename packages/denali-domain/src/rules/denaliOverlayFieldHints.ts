import { toDenaliTemplateStoragePath } from "@repo/types/denali";

import { DENALI_FIELD_DEFINITIONS } from "../registry/denaliFieldRegistryData";
import type { DenaliContextualRule } from "../registry/DenaliFieldRegistry.types";

import { denaliRuleSet, findDenaliRuleField, type DenaliRuleSet } from "./denaliRuleModel";
import {
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
} from "./denaliRuleModel.types";

/** i18n message key suffix under `settings.tourWizardTemplateConditional_*`. */
export type DenaliOverlayContextualHintKey =
  | "transportDong"
  | "transportCost"
  | "transportPersonalCar"
  | "transportAdminCapacity"
  | "transportTrainSeat"
  | "requiresPayment"
  | "requiresLocalGuide"
  | "groupInsurance"
  | "peakExperience"
  | "customServices"
  | "tourKindSelected";

export type DenaliOverlayFieldHint =
  | { readonly kind: "contextual"; readonly messageKey: DenaliOverlayContextualHintKey }
  | { readonly kind: "matrix"; readonly messageKey: "variesByClassification" };

function contextualRuleToHintKey(rule: DenaliContextualRule): DenaliOverlayContextualHintKey | null {
  switch (rule.kind) {
    case "transportDongVisible":
      return "transportDong";
    case "transportOrganizedCostVisible":
      return "transportCost";
    case "transportPersonalCarOptionVisible":
      return "transportPersonalCar";
    case "transportAdminCapacityVisible":
      return "transportAdminCapacity";
    case "transportTrainSeatVisible":
      return "transportTrainSeat";
    case "whenTruthy":
      if (rule.watchCanonical === "pricing.requiresPayment") {
        return "requiresPayment";
      }
      if (rule.watchCanonical === "requiresLocalGuide") {
        return "requiresLocalGuide";
      }
      if (rule.watchCanonical === "basicInfo.tourType") {
        return "tourKindSelected";
      }
      return null;
    case "capability":
      return rule.flag === "canDefineCustomServices" ? "customServices" : null;
    case "peakExperienceVisible":
      return "peakExperience";
    case "groupInsuranceVisible":
      return "groupInsurance";
    case "multiDayEndDateTimeRequired":
      return null;
    default:
      return null;
  }
}

function fieldHiddenVarianceInBaseRuleSet(
  canonicalPath: string,
  base: DenaliRuleSet = denaliRuleSet,
): boolean {
  let seenHidden: boolean | undefined;

  for (const category of DENALI_RULE_MODEL_CATEGORIES) {
    for (const duration of DENALI_RULE_MODEL_DURATIONS) {
      const model = base[category][duration];
      if (model == null) {
        continue;
      }
      const field = findDenaliRuleField(model, canonicalPath);
      if (field == null) {
        continue;
      }
      if (seenHidden === undefined) {
        seenHidden = field.hidden;
        continue;
      }
      if (seenHidden !== field.hidden) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Layer C overlay table hints keyed by template storage path (contextual + matrix variance).
 */
export function getDenaliSettingsOverlayFieldHints(
  base: DenaliRuleSet = denaliRuleSet,
): ReadonlyMap<string, readonly DenaliOverlayFieldHint[]> {
  const hints = new Map<string, DenaliOverlayFieldHint[]>();

  for (const def of DENALI_FIELD_DEFINITIONS) {
    if (def.inRuleModel === false) {
      continue;
    }
    const surface = def.settingsSurface ?? "section";
    if (surface !== "section") {
      continue;
    }

    const storagePath = toDenaliTemplateStoragePath(def.canonicalPath);
    const row: DenaliOverlayFieldHint[] = [];

    if (def.contextualVisibility != null) {
      const messageKey = contextualRuleToHintKey(def.contextualVisibility);
      if (messageKey != null) {
        row.push({ kind: "contextual", messageKey });
      }
    }

    if (fieldHiddenVarianceInBaseRuleSet(def.canonicalPath, base)) {
      row.push({ kind: "matrix", messageKey: "variesByClassification" });
    }

    if (row.length > 0) {
      hints.set(storagePath, row);
    }
  }

  return hints;
}
