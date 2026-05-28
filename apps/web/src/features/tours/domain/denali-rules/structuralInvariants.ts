/**
 * Registry-driven structural invariants (ghost purge, defaults, itinerary sync).
 */

import { readDenaliCanonicalBasics } from "@/features/tours/wizard/denali/denaliCanonicalBasicsControl";
import {
  computeDenaliTourDayCountFromKind,
  syncDenaliItineraryRows,
} from "@/features/tours/wizard/denali/denaliItinerarySync";
import { isDenaliAsyncAssetCanonicalPath } from "@/features/tours/wizard/denali/registry/DenaliFieldRegistry";
import { DENALI_GLOBAL_STRUCTURAL_INVARIANTS } from "@/features/tours/wizard/denali/registry/denaliGlobalStructuralInvariants";
import { DENALI_FIELD_DEFINITIONS } from "@/features/tours/wizard/denali/registry/denaliFieldRegistryData";
import type {
  DenaliGlobalStructuralInvariant,
  DenaliStructuralInvariant,
} from "@/features/tours/wizard/denali/registry/DenaliFieldRegistry.types";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import type { DenaliInvariantEngineContext } from "@/features/tours/wizard/denali/rules/denaliRuleModel.types";
import { mapDenaliCanonicalToFormPath } from "@/features/tours/wizard/denali/rules/denaliRuleRequired";
import {
  evaluateDenaliContextualVisibility,
  getDenaliFieldDefinitionByCanonicalPath,
  isDenaliFieldVisibleInModel,
  type DenaliUIContextOptions,
} from "@/features/tours/wizard/denali/rules/denaliUIAdapter";
import { getDenaliFormPathValue, setDenaliFormPathValue } from "@/features/tours/wizard/denali/denaliFormPathUtils";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import type { DenaliTourKind } from "@repo/types";

import { normalizeDenaliWizardForm } from "./clearHiddenFormValues";
import { resolveDenaliRuleModelFromForm } from "./resolveRuleModel";

function cloneDenaliStructuralSections(
  form: DenaliCreateTourWizardForm,
): DenaliCreateTourWizardForm {
  return {
    ...form,
    basicInfo: { ...form.basicInfo },
    programNature: { ...form.programNature },
    transport: { ...form.transport },
    participantRequirements: { ...form.participantRequirements },
  };
}

function clearDenaliCanonicalLeaf(
  form: DenaliCreateTourWizardForm,
  canonicalPath: string,
): void {
  if (isDenaliAsyncAssetCanonicalPath(canonicalPath)) {
    return;
  }
  setDenaliFormPathValue(form, mapDenaliCanonicalToFormPath(canonicalPath), undefined);
}

function applyStructuralInvariantRule(
  form: DenaliCreateTourWizardForm,
  canonicalPath: string,
  rule: DenaliStructuralInvariant,
  ctx: DenaliInvariantEngineContext,
): void {
  const basics = readDenaliCanonicalBasics(form.basicInfo.tourType as DenaliTourKind | undefined);

  switch (rule.kind) {
    case "clearWhenNotVisible": {
      const def = getDenaliFieldDefinitionByCanonicalPath(canonicalPath);
      const visible =
        ctx.model != null
          ? isDenaliFieldVisibleInModel(ctx.model, canonicalPath, form, ctx.uiOptions)
          : def?.contextualVisibility == null
            ? true
            : evaluateDenaliContextualVisibility(canonicalPath, form, ctx.uiOptions);
      if (!visible) {
        clearDenaliCanonicalLeaf(form, canonicalPath);
      }
      return;
    }
    case "defaultWhenVisible": {
      if (ctx.model == null) {
        return;
      }
      if (!isDenaliFieldVisibleInModel(ctx.model, canonicalPath, form, ctx.uiOptions)) {
        return;
      }
      const formPath = mapDenaliCanonicalToFormPath(canonicalPath);
      if (getDenaliFormPathValue(form, formPath) == null) {
        setDenaliFormPathValue(form, formPath, rule.value);
      }
      return;
    }
    case "enforceValueWhenCategory": {
      if (basics?.category === rule.category) {
        setDenaliFormPathValue(form, mapDenaliCanonicalToFormPath(canonicalPath), rule.value);
      }
      return;
    }
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

function applyGlobalStructuralInvariant(
  form: DenaliCreateTourWizardForm,
  rule: DenaliGlobalStructuralInvariant,
): void {
  const basics = readDenaliCanonicalBasics(form.basicInfo.tourType as DenaliTourKind | undefined);

  switch (rule.kind) {
    case "clearFieldWhenTransportMode": {
      const mode = form.transport.transportMode;
      if (mode != null && (rule.modes as readonly string[]).includes(mode)) {
        clearDenaliCanonicalLeaf(form, rule.targetCanonical);
      }
      return;
    }
    case "syncProgramItineraryToDayCount": {
      const isMulti = basics?.duration === "multi_day";
      if (!isMulti) {
        form.programNature.itinerary = undefined;
        return;
      }
      const dayCount = computeDenaliTourDayCountFromKind(
        form.basicInfo.tourType as DenaliTourKind | undefined,
        form.basicInfo.startDateTime ?? "",
        form.basicInfo.endDateTime,
      );
      form.programNature.itinerary = syncDenaliItineraryRows(
        form.programNature.itinerary,
        dayCount,
      );
      return;
    }
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

function buildInvariantEngineContext(
  form: DenaliCreateTourWizardForm,
  uiOptions: DenaliUIContextOptions | undefined,
  ruleSet: DenaliRuleSet,
): DenaliInvariantEngineContext {
  return {
    ruleSet,
    model: resolveDenaliRuleModelFromForm(form, ruleSet),
    uiOptions,
  };
}

export function applyDenaliStructuralInvariants(
  form: DenaliCreateTourWizardForm,
  uiOptions?: DenaliUIContextOptions,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): DenaliCreateTourWizardForm {
  const next = cloneDenaliStructuralSections(form);
  const ctx = buildInvariantEngineContext(next, uiOptions, ruleSet);

  for (const def of DENALI_FIELD_DEFINITIONS) {
    if (def.structuralInvariant == null) {
      continue;
    }
    applyStructuralInvariantRule(next, def.canonicalPath, def.structuralInvariant, ctx);
  }

  for (const globalRule of DENALI_GLOBAL_STRUCTURAL_INVARIANTS) {
    applyGlobalStructuralInvariant(next, globalRule);
  }

  return next;
}

export function getDenaliSafeFormState(
  form: DenaliCreateTourWizardForm,
  uiOptions?: DenaliUIContextOptions,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): DenaliCreateTourWizardForm {
  return normalizeDenaliWizardForm(form, uiOptions, ruleSet);
}
