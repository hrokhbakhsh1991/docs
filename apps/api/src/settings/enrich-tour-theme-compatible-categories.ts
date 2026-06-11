import { resolveThemeCompatibleCategories } from "@app-tour/workspace-denali";

import type { TourThemeResource } from "./settings.types";

export function enrichTourThemeCompatibleCategories(
  theme: TourThemeResource
): TourThemeResource {
  return Object.freeze({
    ...theme,
    compatibleCategories: resolveThemeCompatibleCategories(theme.formProfile),
  });
}

export function enrichTourThemesCompatibleCategories(
  items: readonly TourThemeResource[]
): TourThemeResource[] {
  return items.map((item) => enrichTourThemeCompatibleCategories(item));
}
