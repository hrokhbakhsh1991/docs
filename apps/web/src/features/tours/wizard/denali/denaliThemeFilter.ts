/**
 * Denali wizard — theme catalogue filter.
 *
 * Each workspace theme carries a `formProfile` tag
 * (e.g. `mountain_outdoor`, `nature_trip`, `denali_pilot`, `general`).
 * When the user is on the program step, only themes whose profile is
 * compatible with the currently selected canonical category should be
 * shown — otherwise themes tagged for a *different* category (e.g.
 * an event/cinema theme) appear in the single-day mountain wizard.
 *
 * Compatibility table (map.md §5.1 / placement-v1 §3.1):
 *
 *   category   → compatible formProfiles
 *   ──────────────────────────────────────────────────────────────
 *   mountain   → mountain_outdoor, denali_pilot, general
 *   nature     → nature_trip, denali_pilot, general
 *   desert     → nature_trip, denali_pilot, general   (closest proxy)
 *   event      → urban_event, cinema_event, cultural_tour, general
 *   (unknown)  → all active themes (safe fallback)
 */

import type { TourFormProfile } from "@repo/types";

import type { DenaliTourCategory } from "./denaliCanonicalBasicsControl";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";

const CATEGORY_COMPATIBLE_PROFILES: Record<DenaliTourCategory, readonly TourFormProfile[]> = {
  mountain: ["mountain_outdoor", "denali_pilot", "general"],
  nature:   ["nature_trip",      "denali_pilot", "general"],
  desert:   ["nature_trip",      "denali_pilot", "general"],
  event:    ["urban_event", "cinema_event", "cultural_tour", "general"],
};

/**
 * Returns the subset of `themes` whose `formProfile` is compatible
 * with `category`. Themes with `formProfile === "general"` are always
 * included as a catch-all fallback.
 *
 * If `category` is `undefined` (no selection yet), all active themes
 * are returned so the select is never empty.
 */
export function filterDenaliThemesByCategory(
  themes: SettingsTourThemeDto[],
  category: DenaliTourCategory | undefined,
): SettingsTourThemeDto[] {
  if (category == null) return themes;
  const allowed = new Set<TourFormProfile>(CATEGORY_COMPATIBLE_PROFILES[category]);
  return themes.filter((t) => allowed.has(t.formProfile));
}
