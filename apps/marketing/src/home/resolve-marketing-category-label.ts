import { resolveMarketingCatalogCardCategoryLabel } from "@/catalog/resolve-marketing-catalog-category-label";

/** Localized chip label; filter href keeps canonical slug. */
export function resolveMarketingCategoryLabel(
  categorySlug: string,
  translate: (key: string) => string
): string {
  return resolveMarketingCatalogCardCategoryLabel(categorySlug, translate) ?? categorySlug.trim();
}
