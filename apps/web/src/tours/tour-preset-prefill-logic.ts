import type { TourPresetResource } from "@/features/settings/settings-module-types";

import {
  getCanonicalStringValue,
  getCanonicalValue,
  setCanonicalStringValue,
  setCanonicalValue,
} from "./tour-wizard-draft-path";
import type { TourWizardDraft } from "./tour-wizard-draft";

export const TOUR_PRESET_PREFILL_TEST_IDS = {
  applied: "operator-wizard-preset-applied",
} as const;

export function resolvePresetId(param: string | null | undefined): string | null {
  if (param == null) {
    return null;
  }
  const trimmed = param.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function findActiveTourPreset(
  items: readonly TourPresetResource[],
  presetId: string
): TourPresetResource | null {
  const match = items.find((item) => item.id === presetId);
  if (match == null || match.isActive === false) {
    return null;
  }
  return match;
}

/** Thin re-export — SoT via host-adapter runtime. */
export { readActiveThemeIds } from "@/wizard/host-adapter-runtime";

export function applyTourPresetToDraft(
  draft: TourWizardDraft,
  preset: TourPresetResource,
  activeThemeIds?: readonly string[]
): TourWizardDraft {
  let next = draft;
  const title = getCanonicalStringValue(next, "title");
  if (title.trim().length === 0 && preset.name.trim().length > 0) {
    next = setCanonicalStringValue(next, "title", preset.name.trim());
  }

  const themeId = preset.themeId?.trim() ?? "";
  if (themeId.length === 0) {
    return next;
  }

  const currentThemes = getCanonicalValue(next, "program.themeIds");
  const hasThemes = Array.isArray(currentThemes) && currentThemes.length > 0;
  if (hasThemes) {
    return next;
  }
  if (activeThemeIds !== undefined && !activeThemeIds.includes(themeId)) {
    return next;
  }
  return setCanonicalValue(next, "program.themeIds", [themeId]);
}
