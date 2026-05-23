import type { TourFormProfile } from "@repo/types";

import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import type { SettingsEquipmentDto } from "@/lib/settings-equipment.client";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";

/** Discriminated wizard bootstrap source (map.md §1). */
export type WizardPrefillKind = "blank" | "preset" | "clone";

export type WizardPrefillQuery =
  | { kind: "blank" }
  | { kind: "preset"; presetId: string }
  | { kind: "clone"; cloneTourId: string };

/** Alias for map-phase F1.4 / F1.7. */
export type WizardPrefillSource = WizardPrefillQuery;

export type WizardPrefillRail = "denali" | "classic";

/** Result of {@link loadWizardPrefill} — ready to write to localStorage. */
export type WizardPrefillResult = {
  rail: WizardPrefillRail;
  serializedDraft: string;
};

export type LoadWizardPrefillContext = {
  tenantSlug: string | null;
  tenantFormContract: TenantTourFormContract;
  signal?: AbortSignal;
  fetchTour?: (tourId: string, signal?: AbortSignal) => Promise<unknown>;
  fetchPreset?: (presetId: string, signal?: AbortSignal) => Promise<TourPresetForPrefill>;
  fetchThemes?: (signal?: AbortSignal) => Promise<SettingsTourThemeDto[]>;
  fetchEquipment?: (signal?: AbortSignal) => Promise<SettingsEquipmentDto[]>;
  fetchWizardTemplate?: (signal?: AbortSignal) => Promise<import("@/features/tours/wizard/template/tenant-wizard-template.types").TenantWizardTemplateEnvelope>;
};

export type TourPresetForPrefill = {
  formProfile?: TourFormProfile | string | null;
  defaults?: Record<string, unknown>;
  matchTourType?: string | null;
  matchMainTourThemeId?: string | null;
};
