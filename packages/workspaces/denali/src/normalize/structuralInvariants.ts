import { readDenaliCanonicalBasics } from "../adapters/denaliCanonicalBasicsControl";
import {
  computeDenaliTourDayCountFromKind,
  syncDenaliItineraryRows,
} from "../adapters/denaliItinerarySync";
import { getDenaliFormPathValue, setDenaliFormPathValue } from "../adapters/denaliFormPathUtils";
import { isDenaliAsyncAssetCanonicalPath } from "../field-registry/DenaliFieldRegistry";
import { DENALI_FIELD_DEFINITIONS } from "../field-registry/denaliFieldRegistryData";
import type {
  DenaliGlobalStructuralInvariant,
  DenaliStructuralInvariant,
} from "../field-registry/DenaliFieldRegistry.types";
import { DENALI_GLOBAL_STRUCTURAL_INVARIANTS } from "../registry/denaliGlobalStructuralInvariants";
import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";
import {
  parseDenaliItineraryDays,
  pruneItinerarySegmentPhotoIds,
} from "../schemas/denaliItineraryDaySchema";
import type { DenaliTourKind } from "../types/legacy/repo-types";
import { mapDenaliCanonicalToFormPath } from "../rules/denaliCanonicalPaths";
import type { DenaliRuleSet } from "../rules/denaliRuleModel";
import { denaliRuleSet } from "../rules/denaliRuleModel";
import type { DenaliInvariantEngineContext } from "../rules/denaliRuleModel.types";
import {
  evaluateDenaliContextualVisibility,
  getDenaliFieldDefinitionByCanonicalPath,
  isDenaliFieldVisibleInModel,
  type DenaliUIContextOptions,
} from "../rules/denaliUIAdapter";

import {
  omitEmptyDenaliGatheringPoints,
  parseDenaliGatheringPoints,
} from "../ui/logic/denali-location-types";
import { normalizeDenaliWizardForm } from "./clearHiddenFormValues";
import { resolveDenaliRuleModelFromForm } from "./resolveRuleModel";

function cloneDenaliStructuralSections(
  form: DenaliCreateTourWizardForm
): DenaliCreateTourWizardForm {
  return {
    ...form,
    basicInfo: { ...form.basicInfo },
    programNature: { ...form.programNature },
    transport: { ...form.transport },
    participantRequirements: { ...form.participantRequirements },
  };
}

function clearDenaliCanonicalLeaf(form: DenaliCreateTourWizardForm, canonicalPath: string): void {
  if (isDenaliAsyncAssetCanonicalPath(canonicalPath)) {
    return;
  }
  setDenaliFormPathValue(form, mapDenaliCanonicalToFormPath(canonicalPath), undefined);
}

function applyStructuralInvariantRule(
  form: DenaliCreateTourWizardForm,
  canonicalPath: string,
  rule: DenaliStructuralInvariant,
  ctx: DenaliInvariantEngineContext
): void {
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
        if (canonicalPath === "program.itinerary" || canonicalPath === "photos") {
          const formPath = mapDenaliCanonicalToFormPath(canonicalPath);
          const existing = getDenaliFormPathValue(form, formPath);
          if (Array.isArray(existing) && existing.length > 0) {
            return;
          }
        }
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
      const existing = getDenaliFormPathValue(form, formPath);
      // Empty string is not a seeded default — treat like missing (INV-DENALI-WIZ-010).
      if (existing == null || existing === "") {
        setDenaliFormPathValue(form, formPath, rule.value);
      }
      return;
    }
    case "enforceValueWhenCategory": {
      const basics = readDenaliCanonicalBasics(form.basicInfo.tourType as DenaliTourKind | undefined);
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

function collectAllowedPhotoIdsFromForm(form: DenaliCreateTourWizardForm): ReadonlySet<string> {
  const ids = new Set<string>();
  const photos = form.photosData?.photos;
  if (!Array.isArray(photos)) {
    return ids;
  }
  for (const entry of photos) {
    if (entry == null || typeof entry !== "object") {
      continue;
    }
    const id = (entry as { id?: unknown }).id;
    if (typeof id === "string" && id.trim().length > 0) {
      ids.add(id.trim());
    }
  }
  return ids;
}

function applyGlobalStructuralInvariant(
  form: DenaliCreateTourWizardForm,
  rule: DenaliGlobalStructuralInvariant
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
        if (form.programNature.itinerary != null && form.programNature.itinerary.length > 0) {
          return;
        }
        form.programNature.itinerary = [];
        return;
      }
      const dayCount = computeDenaliTourDayCountFromKind(
        form.basicInfo.tourType as DenaliTourKind | undefined,
        form.basicInfo.startDateTime ?? "",
        form.basicInfo.endDateTime
      );
      form.programNature.itinerary = syncDenaliItineraryRows(
        form.programNature.itinerary as Parameters<typeof syncDenaliItineraryRows>[0],
        dayCount
      );
      return;
    }
    case "pruneItinerarySegmentPhotoIds": {
      const itinerary = form.programNature.itinerary;
      if (!Array.isArray(itinerary) || itinerary.length === 0) {
        return;
      }
      const parsed = parseDenaliItineraryDays(itinerary);
      const pruned = pruneItinerarySegmentPhotoIds(parsed, collectAllowedPhotoIdsFromForm(form));
      if (JSON.stringify(pruned) !== JSON.stringify(parsed)) {
        form.programNature.itinerary = pruned as typeof form.programNature.itinerary;
      }
      return;
    }
    case "omitEmptyGatheringPoints": {
      const current = parseDenaliGatheringPoints(form.tripDetails?.logistics?.gatheringPoints);
      const next = omitEmptyDenaliGatheringPoints(current);
      if (JSON.stringify(next) === JSON.stringify(current)) {
        return;
      }
      form.tripDetails = {
        ...form.tripDetails,
        logistics: {
          ...form.tripDetails?.logistics,
          gatheringPoints: next,
        },
      };
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
  ruleSet: DenaliRuleSet
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
  ruleSet: DenaliRuleSet = denaliRuleSet
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
  ruleSet: DenaliRuleSet = denaliRuleSet
): DenaliCreateTourWizardForm {
  return normalizeDenaliWizardForm(form, uiOptions, ruleSet);
}
