import type { PresetsAdvancedPayload } from "@/features/settings/presets-advanced-types";
import type { TourPresetResource } from "@/features/settings/settings-module-types";
import { getCanonicalStringValue, getCanonicalValue } from "./tour-wizard-draft-path";
import type { TourWizardDraft } from "./tour-wizard-draft";

/** Explicit selection wins; otherwise the first matching enabled rule wins, then default. */
export function resolveTourPreset(input: {
  presetId: string | null;
  presets: readonly TourPresetResource[];
  config: PresetsAdvancedPayload | null;
  draft: TourWizardDraft;
}): TourPresetResource | null {
  const active = (id: string | null) =>
    input.presets.find((preset) => preset.id === id && preset.isActive !== false) ?? null;
  if (input.presetId !== null) return active(input.presetId);
  if (!input.config?.autoMatchEnabled) return null;
  const category = getCanonicalStringValue(input.draft, "category");
  const themes = getCanonicalValue(input.draft, "program.themeIds");
  for (const rule of input.config.matchRules) {
    if (!rule.enabled || !rule.presetId) continue;
    if (rule.tourType && rule.tourType !== category) continue;
    if (rule.themeId && (!Array.isArray(themes) || !themes.includes(rule.themeId))) continue;
    const preset = active(rule.presetId);
    if (preset !== null) return preset;
  }
  return active(input.config.defaultPresetId);
}

/** Reject malformed optional configuration rather than guessing matching rules. */
export function readPresetMatchingConfig(value: unknown): PresetsAdvancedPayload | null {
  if (value === null || typeof value !== "object") return null;
  const config = value as Record<string, unknown>;
  const nullableString = (field: unknown) => field === null || typeof field === "string";
  if (
    typeof config.autoMatchEnabled !== "boolean" ||
    !nullableString(config.defaultPresetId) ||
    !Array.isArray(config.matchRules)
  )
    return null;
  if (
    !config.matchRules.every((rule: unknown) => {
      if (rule === null || typeof rule !== "object") return false;
      const entry = rule as Record<string, unknown>;
      return (
        typeof entry.id === "string" &&
        typeof entry.enabled === "boolean" &&
        nullableString(entry.tourType) &&
        nullableString(entry.themeId) &&
        nullableString(entry.presetId)
      );
    })
  )
    return null;
  return config as PresetsAdvancedPayload;
}
