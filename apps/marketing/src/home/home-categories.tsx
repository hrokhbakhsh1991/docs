import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { isAppLocale, resolveMarketingToursListPath, type AppLocale } from "@/i18n/routing";

import { resolveMarketingCategoryLabel } from "./resolve-marketing-category-label";

export type HomeCategoriesProps = {
  readonly categories: readonly string[];
};

export async function HomeCategories({ categories }: HomeCategoriesProps) {
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

  return (
    <section data-marketing-home-categories>
      <header>
        <h2>{t("home.full.categories.title")}</h2>
        <p>{t("home.full.categories.lead")}</p>
      </header>
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
    </section>
  );
}
