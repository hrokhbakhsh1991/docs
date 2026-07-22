import { resolveMarketingCatalogCardCategoryLabel } from "@/catalog/resolve-marketing-catalog-category-label";

/** Localized chip label; filter href keeps canonical slug. */
export async function resolveMarketingCategoryLabel(
  categorySlug: string,
  translate: (key: string) => string
): Promise<string> {
  return (
    (await resolveMarketingCatalogCardCategoryLabel(categorySlug, translate)) ??
    categorySlug.trim()
  );
}
