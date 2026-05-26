/**
 * Denali wizard — theme catalogue filter.
 *
 * Each workspace theme carries a `formProfile` tag. When the user is on the program
 * step, only themes whose profile is compatible with the selected canonical category
 * should be shown — driven by {@link getWorkspaceUiCapabilityFlags} (`denaliThemeCategories`).
 *
 * `general` themes are always included as a catch-all fallback.
 */

import { normalizeTourFormProfileInput } from "@repo/types";
import { isDenaliThemeProfileCompatibleWithCategory } from "@repo/shared-contracts";

import type { DenaliTourCategory } from "./denaliCanonicalBasicsControl";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";

/**
 * Returns the subset of `themes` whose `formProfile` is compatible
 * with `category`.
 *
 * If `category` is `undefined` (no selection yet), all active themes
 * are returned so the select is never empty.
 */
export function filterDenaliThemesByCategory(
  themes: SettingsTourThemeDto[],
  category: DenaliTourCategory | undefined,
): SettingsTourThemeDto[] {
  if (category == null) {
    return themes;
  }
  return themes.filter((theme) =>
    isDenaliThemeProfileCompatibleWithCategory(
      normalizeTourFormProfileInput(theme.formProfile),
      category,
    ),
  );
}
