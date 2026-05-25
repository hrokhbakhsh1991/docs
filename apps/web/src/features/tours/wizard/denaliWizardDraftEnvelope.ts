import { DENALI_ROOTS, getTourWorkspaceDefinition } from "@repo/shared-contracts";
import { normalizeDenaliTransportForm } from "@repo/types";

import { sanitizeDenaliFormPatch } from "./denali/denaliFormSanitize";
import { stripBlobUrlsFromDenaliDraftPatch } from "./denali/preserveDenaliWizardBlobMedia";
import type { DenaliRuleSet } from "./denali/rules/denaliRuleModel";
import { denaliRuleSet } from "./denali/rules/denaliRuleModel";
import { prepareDenaliWizardFormForSubmit } from "./denali/validation/denaliRuleAccess";
import {
  DENALI_WIZARD_DRAFT_VERSION_HASH_KEY,
  getDenaliWizardDraftVersionHash,
  readDenaliWizardDraftVersionHashFromRecord,
} from "./denali/denaliWizardDraftVersion";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

export {
  DENALI_WIZARD_DRAFT_VERSION_HASH_KEY,
  DENALI_WIZARD_DRAFT_VERSION_HASH_KEY_LEGACY,
  getDenaliWizardDraftVersionHash,
  readDenaliWizardDraftVersionHashFromRecord,
  isDenaliWizardDraftVersionCompatible,
  computeDenaliWizardDraftVersionHash,
} from "./denali/denaliWizardDraftVersion";

import type { TourWizardDraftMeta } from "./tourWizardProfileResolve";
import { parseTourWizardDraftMeta } from "./tourWizardProfileResolve";

export const DENALI_WIZARD_DRAFT_RAIL = "denali" as const;

export type ParsedDenaliWizardDraft = {
  formPatch: Partial<DenaliCreateTourWizardForm>;
  wizardMeta?: TourWizardDraftMeta;
  /** Structural compatibility hash (steps + rule set). */
  versionHash?: string;
  /** @deprecated Use {@link versionHash}. */
  formStructureVersionHash?: string;
};

function isDenaliFormPatch(value: unknown): value is Partial<DenaliCreateTourWizardForm> {
  return value != null && typeof value === "object" && "basicInfo" in (value as object);
}

export function parseDenaliWizardDraftEnvelope(
  parsed: Record<string, unknown> | null | undefined,
): ParsedDenaliWizardDraft | null {
  if (parsed == null || typeof parsed !== "object") return null;
  try {
    const wizardMeta = parseTourWizardDraftMeta(parsed);
    const rail = parsed._wizardRail;
    const ws = getTourWorkspaceDefinition(wizardMeta?.resolvedFormProfile as any);
    const isDenaliRail =
      rail === DENALI_WIZARD_DRAFT_RAIL || ws?.ui.wizardMode === "denali";
    if (!isDenaliRail && !isDenaliFormPatch(parsed)) {
      return null;
    }
    const {
      _wizardMeta: _m,
      _wizardRail: _r,
      [DENALI_WIZARD_DRAFT_VERSION_HASH_KEY]: _versionHash,
      ...rest
    } = parsed as Record<string, unknown>;
    if (!isDenaliFormPatch(rest)) {
      return null;
    }
    const sanitized: Partial<DenaliCreateTourWizardForm> = {};
    for (const key of DENALI_ROOTS) {
      const v = rest[key];
      if (v != null && typeof v === "object" && !Array.isArray(v)) {
        (sanitized as Record<string, unknown>)[key] = v;
      }
    }
    const versionHash = readDenaliWizardDraftVersionHashFromRecord(parsed);
    return {
      formPatch: sanitizeDenaliFormPatch(sanitized),
      wizardMeta,
      versionHash,
      formStructureVersionHash: versionHash,
    };
  } catch {
    return null;
  }
}

export function parseDenaliWizardDraftRecord(raw: string | null): ParsedDenaliWizardDraft | null {
  if (raw == null || raw.trim() === "") return null;
  try {
    return parseDenaliWizardDraftEnvelope(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return null;
  }
}

export function serializeDenaliWizardDraft(
  formValues: Partial<DenaliCreateTourWizardForm>,
  wizardMeta: TourWizardDraftMeta | undefined,
): string {
  const base: Record<string, unknown> = {
    ...sanitizeDenaliFormPatch(stripBlobUrlsFromDenaliDraftPatch(formValues)),
    _wizardRail: DENALI_WIZARD_DRAFT_RAIL,
    [DENALI_WIZARD_DRAFT_VERSION_HASH_KEY]: getDenaliWizardDraftVersionHash(),
  };
  if (wizardMeta) {
    base._wizardMeta = wizardMeta;
  }
  return JSON.stringify(base);
}

export function mergeDenaliWizardDefaults(
  defaults: DenaliCreateTourWizardForm,
  patch: Partial<DenaliCreateTourWizardForm>,
  ruleSet: DenaliRuleSet = denaliRuleSet,
): DenaliCreateTourWizardForm {
  const clean = sanitizeDenaliFormPatch(patch);
  const merged = {
    ...defaults,
    ...clean,
    basicInfo: { ...defaults.basicInfo, ...clean.basicInfo },
    programNature: { ...defaults.programNature, ...clean.programNature },
    transport: normalizeDenaliTransportForm({ ...defaults.transport, ...clean.transport }),
    pricingPayment: { ...defaults.pricingPayment, ...clean.pricingPayment },
    participantRequirements: {
      ...defaults.participantRequirements,
      ...clean.participantRequirements,
    },
    policies: { ...defaults.policies, ...clean.policies },
    photosData: { ...defaults.photosData, ...clean.photosData },
    tripDetails: {
      ...defaults.tripDetails,
      ...clean.tripDetails,
      logistics: {
        ...defaults.tripDetails?.logistics,
        ...clean.tripDetails?.logistics,
        gatheringPoints:
          clean.tripDetails?.logistics?.gatheringPoints ??
          defaults.tripDetails?.logistics?.gatheringPoints ??
          [],
      },
    },
  };
  return prepareDenaliWizardFormForSubmit(merged, ruleSet);
}
