import { DENALI_ROOTS, getTourWorkspaceDefinition } from "@repo/shared-contracts";
import { normalizeDenaliTransportForm } from "@repo/types";

import { sanitizeDenaliFormPatch } from "./denali/denaliFormSanitize";
import { normalizeDenaliWizardForm } from "./denali/validation/denaliRuleAccess";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import type { TourWizardDraftMeta } from "./tourWizardProfileResolve";
import { parseTourWizardDraftMeta } from "./tourWizardProfileResolve";

export const DENALI_WIZARD_DRAFT_RAIL = "denali" as const;

export type ParsedDenaliWizardDraft = {
  formPatch: Partial<DenaliCreateTourWizardForm>;
  wizardMeta?: TourWizardDraftMeta;
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
    const { _wizardMeta: _m, _wizardRail: _r, ...rest } = parsed as any;
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
    return {
      formPatch: sanitizeDenaliFormPatch(sanitized),
      wizardMeta,
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
    ...sanitizeDenaliFormPatch(formValues),
    _wizardRail: DENALI_WIZARD_DRAFT_RAIL,
  };
  if (wizardMeta) {
    base._wizardMeta = wizardMeta;
  }
  return JSON.stringify(base);
}

export function mergeDenaliWizardDefaults(
  defaults: DenaliCreateTourWizardForm,
  patch: Partial<DenaliCreateTourWizardForm>,
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
  };
  return normalizeDenaliWizardForm(merged);
}
