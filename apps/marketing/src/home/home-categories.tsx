import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { isAppLocale, resolveMarketingToursListPath, type AppLocale } from "@/i18n/routing";

import { resolveMarketingCategoryLabel } from "./resolve-marketing-category-label";

export type HomeCategoriesProps = {
  readonly categories: readonly string[];
  readonly embedded?: boolean;
};

export async function HomeCategories({ categories, embedded = false }: HomeCategoriesProps) {
  if (categories.length === 0) {
    return null;
  }

  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const categoryChips = await Promise.all(
    categories.map(async (category) => ({
      category,
      label: await resolveMarketingCategoryLabel(category, t),
    }))
  );

  const chips = (
    <div data-marketing-home-categories-row>
      {categoryChips.map(({ category, label }) => (
        <Link
          key={category}
          href={resolveMarketingToursListPath(locale, { category })}
          data-marketing-home-category-chip
          data-marketing-home-category-chip-id={category}
        >
          {label}
        </Link>
      ))}
    </div>
  );

  if (embedded) {
    return (
      <div data-marketing-home-categories data-marketing-home-categories-embedded>
        {chips}
      </div>
    );
  }

  return (
    <section data-marketing-home-categories>
      <header>
        <h2>{t("home.full.categories.title")}</h2>
        <p>{t("home.full.categories.lead")}</p>
      </header>
      {chips}
    </section>
  );
}
