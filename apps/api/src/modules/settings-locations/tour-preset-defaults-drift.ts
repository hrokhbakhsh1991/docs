/**
 * Drift detection between `preset.formProfile` and the form profile of
 * `defaults.overview.mainTourThemeId` (or the legacy column
 * `matchMainTourThemeId`).
 *
 * Policy (Phase 2 — soft/warn-only, per prompt.md "Prompt 3-A" §3 and the
 * follow-up direction in the chat):
 *   - The settings service wires this helper into `create()` and `update()`,
 *     queries `workspace_tour_themes` scoped by `workspace_id`, and converts
 *     non-`ok` results into a `logger.warn(...)` call. The save is never
 *     blocked. This is the gentle path that lets us collect signal without
 *     breaking existing admin workflows.
 *   - A later hardening pass can flip POST + PATCH-with-defaults to throw
 *     `BadRequestException` while keeping PATCH-only-`formProfile` as a warn.
 *
 * Keeping the result and the warning message generator separate means tests
 * can verify the human-readable signal without standing up a real Logger.
 */
import type { TourFormProfile } from "@repo/types";

export type ThemeLookupResult = { id: string; formProfile: TourFormProfile } | null;
export type ThemeLookup = (themeId: string) => Promise<ThemeLookupResult>;

export type PresetDriftCheckInput = {
  presetFormProfile: TourFormProfile;
  defaultsOverviewMainTourThemeId: string | null | undefined;
  matchMainTourThemeId: string | null | undefined;
};

export type PresetDriftOk = { ok: true };
export type PresetDriftThemeMissing = {
  ok: false;
  reason: "preset_theme_not_in_workspace";
  themeId: string;
  presetFormProfile: TourFormProfile;
};
export type PresetDriftProfileMismatch = {
  ok: false;
  reason: "preset_form_profile_mismatches_theme";
  themeId: string;
  presetFormProfile: TourFormProfile;
  themeFormProfile: TourFormProfile;
};
export type PresetDriftResult = PresetDriftOk | PresetDriftThemeMissing | PresetDriftProfileMismatch;

export async function detectPresetThemeProfileDrift(
  input: PresetDriftCheckInput,
  lookup: ThemeLookup,
): Promise<PresetDriftResult> {
  const themeId =
    pickTrimmedNonEmpty(input.defaultsOverviewMainTourThemeId) ??
    pickTrimmedNonEmpty(input.matchMainTourThemeId);
  if (!themeId) return { ok: true };

  const theme = await lookup(themeId);
  if (!theme) {
    return {
      ok: false,
      reason: "preset_theme_not_in_workspace",
      themeId,
      presetFormProfile: input.presetFormProfile,
    };
  }
  if (theme.formProfile !== input.presetFormProfile) {
    return {
      ok: false,
      reason: "preset_form_profile_mismatches_theme",
      themeId,
      presetFormProfile: input.presetFormProfile,
      themeFormProfile: theme.formProfile,
    };
  }
  return { ok: true };
}

function pickTrimmedNonEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  return t === "" ? null : t;
}

/**
 * Produces a structured, log-grep-friendly warning string for a non-`ok`
 * drift result, or `null` when the result is `ok`. Format keeps a stable
 * prefix (`[presets][drift]`) so dashboards / alerts can filter by code.
 */
export function formatPresetDriftWarning(result: PresetDriftResult): string | null {
  if (result.ok) return null;
  if (result.reason === "preset_theme_not_in_workspace") {
    return (
      `[presets][drift] preset_theme_not_in_workspace ` +
      `themeId=${result.themeId} presetFormProfile=${result.presetFormProfile}`
    );
  }
  return (
    `[presets][drift] preset_form_profile_mismatches_theme ` +
    `themeId=${result.themeId} presetFormProfile=${result.presetFormProfile} ` +
    `themeFormProfile=${result.themeFormProfile}`
  );
}
