import {
  DENALI_ROOTS,
  type DenaliRoot,
} from "@repo/shared-contracts";
import {
  isDenaliTourKind,
  migrateLegacyDenaliTransportForm,
  normalizeDenaliTransportForm,
  type DenaliTourKind,
} from "@repo/types";

import { gearCatalogIdsToGearItems } from "@/features/tours/wizard/denali/denaliGearSelection";
import { sanitizeDenaliFormPatch } from "@/features/tours/wizard/denali/denaliFormSanitize";
import type { DenaliGearItem } from "@/features/tours/wizard/schemas/denaliGearItemSchema";
import { normalizeDenaliFormPatch } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import {
  buildDenaliTourCreateDefaultValues,
  type DenaliCreateTourWizardForm,
} from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

/** Denali wizard roots stored in `workspace_tour_creation_presets.defaults` (6-tab shape). */
export const DENALI_PRESET_DEFAULTS_ROOT_KEYS = DENALI_ROOTS;

export type DenaliPresetDefaultsRootKey = DenaliRoot;

const LEGACY_ROOT_KEYS = new Set([
  "autoAcceptRegistrations",
  "overview",
  "pricing",
  "schedule",
  "location",
  "itinerary",
  "participation",
  "logistics",
  "discount",
  "onlinePayment",
  "onlinePayments",
]);

export type PresetToDenaliContext = {
  matchTourType?: string | null;
  matchMainTourThemeId?: string | null;
};

function sectionObject(value: unknown): Record<string, unknown> | undefined {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function uuidStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  return ids.length > 0 ? ids : undefined;
}

function denaliGearItemsFromSection(
  section: Record<string, unknown> | undefined,
): DenaliGearItem[] | undefined {
  if (section == null) return undefined;
  const rawItems = section.gearItems;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const parsed: DenaliGearItem[] = [];
    for (const row of rawItems) {
      if (row == null || typeof row !== "object") continue;
      const id = typeof (row as { id?: unknown }).id === "string" ? (row as { id: string }).id.trim() : "";
      if (!id) continue;
      parsed.push({
        id,
        isRequired: (row as { isRequired?: unknown }).isRequired === true,
      });
    }
    return gearCatalogIdsToGearItems(
      parsed.filter((r) => r.isRequired).map((r) => r.id),
      parsed.filter((r) => !r.isRequired).map((r) => r.id),
    );
  }
  return (
    gearCatalogIdsToGearItems(
      uuidStringArray(section.gearRequiredIds),
      uuidStringArray(section.gearOptionalIds),
    ) ??
    gearCatalogIdsToGearItems(
      uuidStringArray(section.requiredGearIds),
      uuidStringArray(section.optionalGearIds),
    )
  );
}

function mergeParticipantGearIntoPatch(
  patch: Partial<DenaliCreateTourWizardForm>,
  gearItems: DenaliGearItem[] | undefined,
): void {
  if (gearItems == null || gearItems.length === 0) return;
  patch.participantRequirements = {
    ...(patch.participantRequirements ?? {}),
    gearItems,
  };
}

function inferDenaliKindFromLegacy(
  overview: Record<string, unknown>,
  ctx: PresetToDenaliContext,
): DenaliTourKind | undefined {
  const raw = overview.denaliTourKind ?? overview.tourType ?? ctx.matchTourType;
  if (typeof raw === "string" && isDenaliTourKind(raw)) {
    return raw;
  }
  const mt = ctx.matchTourType;
  if (mt === "mountain") return "mountain_day";
  if (mt === "nature") return "nature_day";
  return undefined;
}

/** Maps legacy 8-root preset JSON into Denali sections (best-effort until seed uses 6-tab shape). */
function legacyDefaultsToDenaliPatch(
  defaults: Record<string, unknown>,
  ctx: PresetToDenaliContext,
): Partial<DenaliCreateTourWizardForm> {
  const patch: Partial<DenaliCreateTourWizardForm> = {};
  const overview = sectionObject(defaults.overview) ?? {};
  const participation = sectionObject(defaults.participation) ?? {};
  const policies = sectionObject(defaults.policies) ?? {};
  const logistics = sectionObject(defaults.logistics) ?? {};
  const pricing = sectionObject(defaults.pricing) ?? {};

  const kind = inferDenaliKindFromLegacy(overview, ctx);
  const themeId =
    (typeof overview.mainTourThemeId === "string" && overview.mainTourThemeId.trim()) ||
    ctx.matchMainTourThemeId?.trim() ||
    "";

  if (kind || themeId) {
    patch.basicInfo = {
      ...(kind ? { tourType: kind } : {}),
    } as DenaliCreateTourWizardForm["basicInfo"];
  }

  const program: Partial<DenaliCreateTourWizardForm["programNature"]> = {};
  if (themeId) program.themeIds = [themeId];
  if (typeof overview.shortDescription === "string") {
    program.shortDescription = overview.shortDescription;
  }
  if (typeof overview.longDescription === "string") {
    program.longDescription = overview.longDescription;
  }
  if (Object.keys(program).length > 0) {
    patch.programNature = program as DenaliCreateTourWizardForm["programNature"];
  }

  if (
    typeof logistics.primaryTransportMode === "string" ||
    typeof logistics.privateCarMode === "string" ||
    logistics.fuelShareToman != null
  ) {
    patch.transport = migrateLegacyDenaliTransportForm({
      primaryTransportMode: logistics.primaryTransportMode as string | undefined,
      privateCarAllowed: logistics.supplementalPrivateCar === true,
      privateCarMode: logistics.privateCarMode as string | undefined,
      dongAmountPerSeat:
        typeof logistics.fuelShareToman === "number" ? logistics.fuelShareToman : undefined,
      transportNotes:
        typeof logistics.transportationNotes === "string" ? logistics.transportationNotes : undefined,
    });
  }

  const pricingPayment: Partial<DenaliCreateTourWizardForm["pricingPayment"]> = {};
  if (typeof pricing.basePrice === "number" && pricing.basePrice > 0) {
    pricingPayment.requiresPayment = true;
    pricingPayment.basePricePerPerson = pricing.basePrice;
  }
  if (Object.keys(pricingPayment).length > 0) {
    patch.pricingPayment = pricingPayment as DenaliCreateTourWizardForm["pricingPayment"];
  }

  const participantRequirements: Partial<DenaliCreateTourWizardForm["participantRequirements"]> = {};
  if (typeof participation.minimumAge === "number") {
    participantRequirements.minimumAge = participation.minimumAge;
  }
  if (typeof participation.sportsInsuranceRequired === "boolean") {
    participantRequirements.sportsInsuranceRequired = participation.sportsInsuranceRequired;
  }
  const gearItems = denaliGearItemsFromSection(participation);
  if (gearItems != null) {
    participantRequirements.gearItems = gearItems;
  }
  if (Object.keys(participantRequirements).length > 0) {
    patch.participantRequirements =
      participantRequirements as DenaliCreateTourWizardForm["participantRequirements"];
  }

  if (typeof policies.cancellationPolicy === "string") {
    patch.policies = { policiesText: policies.cancellationPolicy };
  }
  if (typeof policies.policiesText === "string") {
    patch.policies = { policiesText: policies.policiesText };
  }

  return normalizeDenaliFormPatch(sanitizeDenaliFormPatch(patch), buildDenaliTourCreateDefaultValues());
}

/**
 * Keeps only Denali 6-tab roots from preset `defaults`; strips legacy wizard roots.
 * Falls back to legacy mapping when no Denali roots are present (pre–block-B seeds).
 */
export function presetDefaultsToDenaliFormPatch(
  defaults: Record<string, unknown>,
  ctx: PresetToDenaliContext = {},
): Partial<DenaliCreateTourWizardForm> {
  const hasDenaliShape =
    sectionObject(defaults.basicInfo) != null || sectionObject(defaults.programNature) != null;

  if (hasDenaliShape) {
    const patch: Partial<DenaliCreateTourWizardForm> = {};
    for (const key of DENALI_PRESET_DEFAULTS_ROOT_KEYS) {
      const v = defaults[key];
      if (v != null && typeof v === "object" && !Array.isArray(v)) {
        if (key === "transport") {
          patch.transport = normalizeDenaliTransportForm(
            v as Parameters<typeof normalizeDenaliTransportForm>[0],
          );
        } else {
          (patch as Record<string, unknown>)[key] = v;
        }
      }
    }
    const legacyParticipationGear = denaliGearItemsFromSection(sectionObject(defaults.participation));
    const denaliParticipationGear = denaliGearItemsFromSection(
      sectionObject(defaults.participantRequirements),
    );
    mergeParticipantGearIntoPatch(
      patch,
      denaliParticipationGear ?? legacyParticipationGear,
    );
    return normalizeDenaliFormPatch(
      sanitizeDenaliFormPatch(patch),
      buildDenaliTourCreateDefaultValues(),
    );
  }

  return legacyDefaultsToDenaliPatch(defaults, ctx);
}

/** True when stored JSON still uses classic wizard roots (not 6-tab Denali). */
export function presetDefaultsUsesLegacyRoots(defaults: Record<string, unknown>): boolean {
  return Object.keys(defaults).some((k) => LEGACY_ROOT_KEYS.has(k));
}
