import type { DenaliMarketingCategoryGroup } from "./denali-catalog-filter-config";
import { isDenaliMarketingCategoryGroup } from "./denali-catalog-filter-config";

/** Resolve admin category slug to marketing family (`mountain_*` → `mountain`). */
export function resolveDenaliMarketingCategoryFamily(
  category: string | null | undefined,
): DenaliMarketingCategoryGroup | null {
  const slug = category?.trim() ?? "";
  if (slug.startsWith("mountain_")) {
    return "mountain";
  }
  if (slug.startsWith("nature_")) {
    return "nature";
  }
  if (isDenaliMarketingCategoryGroup(slug)) {
    return slug;
  }
  return null;
}
