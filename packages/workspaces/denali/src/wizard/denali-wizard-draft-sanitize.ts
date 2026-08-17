import type { DenaliWizardRuleEvalContext } from "./denali-wizard-rule-eval-context";
import {
  getCanonicalValueFromDraft,
  setCanonicalValueOnDraft,
  type CanonicalWizardDraftEnvelope,
} from "./canonical-draft-access";
import type { DenaliWizardRulesModule } from "./denali-wizard-rules-module";
import { hasDenaliWizardClassification } from "./apply-contextual-render-plan";
import { shouldPersistCanonicalPathFromForm } from "./denali-canonical-form-sync";
import { tourWizardDraftToDenaliForm } from "./denali-wizard-form-adapter";
import {
  DENALI_GATHERING_POINTS_CANONICAL_PATH,
  DENALI_GATHERING_POINTS_NESTED_PATH,
  DENALI_LOCATION_ZONE_GHOST_PATHS,
  denaliLocationZoneOverviewPath,
  isDenaliGatheringPointPopulated,
  isDenaliLocationDataPopulated,
  omitEmptyDenaliGatheringPoints,
  parseDenaliGatheringPoints,
  parseDenaliLocationData,
  resolveDenaliGatheringPointsFromStorage,
  resolveDenaliLocationZoneFromStorage,
  toPersistableDenaliLocationData,
} from "../ui/logic/denali-location-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asDraftEnvelope(draft: Readonly<Record<string, unknown>>): CanonicalWizardDraftEnvelope {
  if (draft.data != null && typeof draft.data === "object" && !Array.isArray(draft.data)) {
    return { data: draft.data as Record<string, unknown> };
  }
  return { data: draft as Record<string, unknown> };
}

function getNestedFormValue(form: Record<string, unknown>, formPath: string): unknown {
  const segments = formPath.split(".");
  let current: unknown = form;
  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function formValueToDraftScalar(value: unknown): unknown {
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return value;
}

function coerceScalarFormValueForDraft(formValue: unknown): unknown {
  if (formValue === null || formValue === undefined) {
    return formValue;
  }
  if (Array.isArray(formValue)) {
    return formValue;
  }
  if (isRecord(formValue)) {
    if (Object.keys(formValue).length === 0) {
      return undefined;
    }
    if (typeof formValue.value === "string" || typeof formValue.value === "number") {
      return formValueToDraftScalar(formValue.value);
    }
    return formValue;
  }
  return formValueToDraftScalar(formValue);
}

function syncDenaliFormToDraftEnvelope(
  draft: CanonicalWizardDraftEnvelope,
  form: Record<string, unknown>,
  rules: DenaliWizardRulesModule
): CanonicalWizardDraftEnvelope {
  let next = draft;
  for (const [canonicalPath, formPath] of Object.entries(rules.canonicalToFormPathMap)) {
    const formValue = getNestedFormValue(form, formPath);
    const draftValue = getCanonicalValueFromDraft(next, canonicalPath);
    if (formValue === undefined) {
      if (draftValue !== undefined) {
        next = setCanonicalValueOnDraft(next, canonicalPath, undefined);
      }
      continue;
    }
    if (!shouldPersistCanonicalPathFromForm(canonicalPath)) {
      continue;
    }
    const mapped = coerceScalarFormValueForDraft(formValue);
    if (JSON.stringify(mapped) !== JSON.stringify(draftValue)) {
      next = setCanonicalValueOnDraft(next, canonicalPath, mapped);
    }
  }
  return next;
}

function promoteDenaliGatheringPointsOnDraft(
  draft: CanonicalWizardDraftEnvelope
): CanonicalWizardDraftEnvelope {
  const resolved = resolveDenaliGatheringPointsFromStorage(
    getCanonicalValueFromDraft(draft, DENALI_GATHERING_POINTS_CANONICAL_PATH),
    getCanonicalValueFromDraft(draft, DENALI_GATHERING_POINTS_NESTED_PATH)
  );
  const populated = omitEmptyDenaliGatheringPoints(resolved);
  if (populated.length === 0) {
    return draft;
  }
  const root = parseDenaliGatheringPoints(
    getCanonicalValueFromDraft(draft, DENALI_GATHERING_POINTS_CANONICAL_PATH)
  );
  if (root.some(isDenaliGatheringPointPopulated)) {
    return draft;
  }
  return setCanonicalValueOnDraft(draft, DENALI_GATHERING_POINTS_CANONICAL_PATH, populated);
}

/**
 * ED-CAMP-PERSIST-01 — persist SoT is overview; root is in-session / form-adapter mirror.
 * Ghost roots stay non-persistable (`shouldPersistCanonicalPathFromForm` → false).
 */
function promoteDenaliLocationZonesOnDraft(
  draft: CanonicalWizardDraftEnvelope
): CanonicalWizardDraftEnvelope {
  let next = draft;
  for (const zone of DENALI_LOCATION_ZONE_GHOST_PATHS) {
    const nestedPath = denaliLocationZoneOverviewPath(zone);
    const resolved = toPersistableDenaliLocationData(
      resolveDenaliLocationZoneFromStorage(
        getCanonicalValueFromDraft(next, zone),
        getCanonicalValueFromDraft(next, nestedPath)
      )
    );
    if (resolved === undefined) {
      continue;
    }
    const nested = parseDenaliLocationData(getCanonicalValueFromDraft(next, nestedPath));
    if (!isDenaliLocationDataPopulated(nested)) {
      next = setCanonicalValueOnDraft(next, nestedPath, resolved);
    }
    const root = parseDenaliLocationData(getCanonicalValueFromDraft(next, zone));
    if (!isDenaliLocationDataPopulated(root)) {
      next = setCanonicalValueOnDraft(next, zone, resolved);
    }
  }
  return next;
}

export function sanitizeDenaliWizardDraftEnvelope(
  draft: CanonicalWizardDraftEnvelope,
  rules: DenaliWizardRulesModule,
  evalContext: DenaliWizardRuleEvalContext
): CanonicalWizardDraftEnvelope {
  if (!hasDenaliWizardClassification(draft, rules)) {
    return draft;
  }
  const promoted = promoteDenaliLocationZonesOnDraft(promoteDenaliGatheringPointsOnDraft(draft));
  const form = tourWizardDraftToDenaliForm(promoted, rules);
  const sanitized = rules.applyDenaliInvariantState(
    form,
    evalContext.uiOptions as Parameters<DenaliWizardRulesModule["applyDenaliInvariantState"]>[1],
    evalContext.ruleSet
  );
  return syncDenaliFormToDraftEnvelope(
    promoted,
    sanitized as unknown as Record<string, unknown>,
    rules
  );
}

export function sanitizeDenaliWizardDraftRecord(
  draft: Readonly<Record<string, unknown>>,
  rules: DenaliWizardRulesModule,
  evalContext: DenaliWizardRuleEvalContext
): Record<string, unknown> {
  const envelope = sanitizeDenaliWizardDraftEnvelope(asDraftEnvelope(draft), rules, evalContext);
  if (draft.data != null && typeof draft.data === "object" && !Array.isArray(draft.data)) {
    return { ...draft, data: envelope.data };
  }
  return envelope.data;
}
