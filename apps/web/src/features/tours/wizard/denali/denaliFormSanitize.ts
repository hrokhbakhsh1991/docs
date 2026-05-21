import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

/** Legacy keys removed from form state (derived at validation/submit instead). */
const STRIP_BASIC = new Set(["isMultiDay"]);
const STRIP_PROGRAM = new Set([
  "difficultyType",
  "mainTourThemeId",
  "secondaryTourThemeIds",
  "altitudeGainApprox",
  "itineraryOutline",
]);
const STRIP_PRICING = new Set(["includesTransportInPrice"]);
const STRIP_PARTICIPANT = new Set([
  "maximumAge",
  "experienceLevel",
  "requiredGearIds",
  "optionalGearIds",
  "medicalNotes",
  "technicalSkillNotes",
]);
const STRIP_POLICIES = new Set([
  "cancellationPolicy",
  "refundPolicy",
  "attendanceRules",
  "safetyPolicy",
  "weatherPolicy",
]);

function omitKeys<T extends Record<string, unknown>>(obj: T, keys: Set<string>): T {
  const out = { ...obj };
  for (const key of keys) {
    delete out[key];
  }
  return out;
}

/** Drops derived/deprecated fields from draft patches and legacy presets before merge. */
export function sanitizeDenaliFormPatch(
  patch: Partial<DenaliCreateTourWizardForm>,
): Partial<DenaliCreateTourWizardForm> {
  const out: Partial<DenaliCreateTourWizardForm> = { ...patch };
  if (patch.basicInfo != null) {
    out.basicInfo = omitKeys(
      patch.basicInfo as Record<string, unknown>,
      STRIP_BASIC,
    ) as DenaliCreateTourWizardForm["basicInfo"];
  }
  if (patch.programNature != null) {
    out.programNature = omitKeys(
      patch.programNature as Record<string, unknown>,
      STRIP_PROGRAM,
    ) as DenaliCreateTourWizardForm["programNature"];
  }
  if (patch.pricingPayment != null) {
    out.pricingPayment = omitKeys(
      patch.pricingPayment as Record<string, unknown>,
      STRIP_PRICING,
    ) as DenaliCreateTourWizardForm["pricingPayment"];
  }
  if (patch.participantRequirements != null) {
    out.participantRequirements = omitKeys(
      patch.participantRequirements as Record<string, unknown>,
      STRIP_PARTICIPANT,
    ) as DenaliCreateTourWizardForm["participantRequirements"];
  }
  if (patch.policies != null) {
    out.policies = omitKeys(
      patch.policies as Record<string, unknown>,
      STRIP_POLICIES,
    ) as DenaliCreateTourWizardForm["policies"];
  }
  return out;
}
