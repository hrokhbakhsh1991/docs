import type { TourFormProfile } from "@repo/types";

import type { SettingsTourPresetDto } from "@/lib/settings-tour-presets.client";

/** Active presets only — workspace sort order. */
export function listActiveTourCreationPresetsSorted(
  presets: SettingsTourPresetDto[] | undefined,
): SettingsTourPresetDto[] {
  if (!presets?.length) return [];
  return [...presets]
    .filter((p) => p.isActive)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}

/** Wizard: show presets compatible with the resolved form profile; active rows first. */
export function listAllTourWizardPresetsSorted(
  presets: SettingsTourPresetDto[] | undefined,
  resolvedFormProfile?: TourFormProfile,
): SettingsTourPresetDto[] {
  if (!presets?.length) return [];
  let list = [...presets];
  if (resolvedFormProfile) {
    list = list.filter((p) => (p.formProfile ?? "general") === resolvedFormProfile);
  }
  return list.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const d = a.sortOrder - b.sortOrder;
    if (d !== 0) return d;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
