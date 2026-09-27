type CatalogTranslation = (key: string) => string;

export function resolveCatalogFreeCollectionLabel(t: CatalogTranslation, locale: string): string {
  const translated = t("detail.freeCollection");
  if (translated !== "catalog.detail.freeCollection") {
    return translated;
  }
  return locale === "en" ? "Free / no payment required" : "رایگان / بدون نیاز به پرداخت";
}
