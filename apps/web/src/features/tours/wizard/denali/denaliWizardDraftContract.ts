/**
 * Target contract for Denali wizard draft JSON (localStorage / server autosave).
 *
 * Success shape: envelope metadata + **`canonical`** payload validated by
 * {@link ../schemas/denaliCanonicalTourSchema.unified} — not the 6-tab RHF form.
 *
 * Current {@link ../denaliWizardDraftEnvelope} still persists RHF roots; this module
 * defines the migration target and gates save/load implementations.
 */

import type { DenaliCanonicalTourModel } from "@repo/types/denali";
import { z } from "zod";

import { mapDenaliWizardToDraftPayload } from "@/features/tours/wizard/domain/mapDenaliWizardToDraftPayload";
import {
  DENALI_WIZARD_DRAFT_RAIL,
  type ParsedDenaliWizardDraft,
} from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import { getDenaliWizardDraftVersionHash } from "@/features/tours/wizard/denali/denaliWizardDraftVersion";
import { denaliCanonicalTourSchema } from "@/features/tours/wizard/schemas/denaliCanonicalTourSchema.unified";
import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";
import { TOUR_WIZARD_CONTRACT_VERSION } from "@/features/tours/wizard/contract/tour-wizard-contract-version";
import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";

/** Required top-level keys on persisted Denali draft JSON (contract v1). */
export const DENALI_WIZARD_DRAFT_CONTRACT_KEYS = [
  "_wizardRail",
  "versionHash",
  "canonical",
] as const;

export const DENALI_WIZARD_DRAFT_OPTIONAL_KEYS = ["_wizardMeta"] as const;

/**
 * Strict envelope: rejects legacy RHF roots (`basicInfo`, `programNature`, …) at top level.
 * `canonical` must satisfy unified submit schema (structural + cross-field rules).
 */
export const denaliWizardDraftEnvelopeContractSchema = z
  .object({
    _wizardRail: z.literal(DENALI_WIZARD_DRAFT_RAIL),
    versionHash: z.string().min(1),
    _wizardMeta: z.record(z.string(), z.unknown()).optional(),
    canonical: denaliCanonicalTourSchema,
  })
  .strict();

export type DenaliWizardDraftEnvelopeContract = z.infer<
  typeof denaliWizardDraftEnvelopeContractSchema
>;

export function formatDenaliWizardDraftContractIssues(
  issues: readonly z.ZodIssue[],
): string {
  return issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

export function validateDenaliWizardDraftEnvelopeContract(
  raw: unknown,
): ReturnType<typeof denaliWizardDraftEnvelopeContractSchema.safeParse> {
  return denaliWizardDraftEnvelopeContractSchema.safeParse(raw);
}

/** Throws when `raw` is not a contract-compliant Denali draft envelope. */
export function assertDenaliWizardDraftEnvelopeContract(raw: unknown): DenaliWizardDraftEnvelopeContract {
  const result = validateDenaliWizardDraftEnvelopeContract(raw);
  if (!result.success) {
    throw new Error(
      `Denali wizard draft contract violation: ${formatDenaliWizardDraftContractIssues(result.error.issues)}`,
    );
  }
  return result.data;
}

/** Load path: wire JSON (localStorage / server) → validated draft envelope. */
export function parseDenaliWizardDraftEnvelope(raw: unknown): DenaliWizardDraftEnvelopeContract {
  return assertDenaliWizardDraftEnvelopeContract(raw);
}

/** Reference envelope: mountain_day fixture mapped to canonical + current version hash. */
export function buildGoldenDenaliWizardDraftEnvelope(options?: {
  wizardMeta?: TourWizardDraftMeta;
}): DenaliWizardDraftEnvelopeContract {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";

  const canonical = mapDenaliWizardToDraftPayload(form).canonical;
  return {
    _wizardRail: DENALI_WIZARD_DRAFT_RAIL,
    versionHash: getDenaliWizardDraftVersionHash(),
    canonical: denaliCanonicalTourSchema.parse(canonical),
    ...(options?.wizardMeta != null ? { _wizardMeta: options.wizardMeta } : {}),
  };
}

export function buildGoldenDenaliWizardDraftMeta(): TourWizardDraftMeta {
  return {
    resolvedFormProfile: "denali_pilot",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
    wizardContractVersion: TOUR_WIZARD_CONTRACT_VERSION,
    savedAt: "2026-06-01T12:00:00.000Z",
  };
}

/** True when JSON looks like today's RHF-root draft (pre-canonical migration). */
export function isLegacyRhfDenaliDraftEnvelope(
  parsed: Record<string, unknown>,
): boolean {
  return (
    parsed._wizardRail === DENALI_WIZARD_DRAFT_RAIL &&
    "basicInfo" in parsed &&
    !("canonical" in parsed)
  );
}

/** Parses legacy {@link ParsedDenaliWizardDraft} JSON shape for contrast tests only. */
export function parseLegacyDenaliDraftRecord(raw: string): ParsedDenaliWizardDraft | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed == null || typeof parsed !== "object") {
      return null;
    }
    if (!isLegacyRhfDenaliDraftEnvelope(parsed)) {
      return null;
    }
    return {
      formPatch: parsed as ParsedDenaliWizardDraft["formPatch"],
      wizardMeta: undefined,
      versionHash:
        typeof parsed.versionHash === "string" ? parsed.versionHash : undefined,
    };
  } catch {
    return null;
  }
}

export type { DenaliCanonicalTourModel };
