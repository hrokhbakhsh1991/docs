import type { MarketingCatalogCard } from "@/catalog/catalog-types";

/** Unique non-empty category labels from catalog cards (stable sort). */
export function deriveHomeCategories(
  items: readonly MarketingCatalogCard[]
): readonly string[] {
  const seen = new Set<string>();
  const categories: string[] = [];

  for (const item of items) {
    const category = item.category?.trim();
    if (category == null || category.length === 0 || seen.has(category)) {
      continue;
    }
    seen.add(category);
    categories.push(category);
  }

  return categories;
}
