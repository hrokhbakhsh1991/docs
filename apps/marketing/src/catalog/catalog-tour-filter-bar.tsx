import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { isAppLocale, resolveMarketingLocalePath, type AppLocale } from "@/i18n/routing";

import {
  DENALI_MARKETING_DIFFICULTY_MAX,
  isDenaliMarketingCategoryGroup,
  isDenaliMarketingPlugin,
} from "@app-tour/workspace-denali/marketing";
import { resolveMarketingCatalogCategoryFilterLabel } from "@/catalog/resolve-marketing-catalog-category-label";

import {
  buildCatalogListQuery,
  buildCatalogListQueryWithoutFilters,
  catalogListHasActiveFilters,
  resolveCatalogSortFilterLabel,
  type CatalogListFilters,
} from "./catalog-list-query";
import type { CatalogFilterOptions } from "./derive-catalog-filter-options";

export type CatalogTourFilterBarProps = {
  readonly filters: CatalogListFilters;
  readonly options: CatalogFilterOptions;
  readonly showCityFilter: boolean;
  readonly defaultCity?: string;
  readonly serverListFilters?: readonly string[];
  readonly pluginId: string;
};

function buildCategoryChipHref(
  listPath: string,
  filters: CatalogListFilters,
  category: string | undefined
): string {
  return `${listPath}${buildCatalogListQuery({
    city: filters.city,
    q: filters.q,
    category,
    difficulty: filters.difficulty != null ? String(filters.difficulty) : undefined,
    fitness: filters.fitness,
    availability: filters.availability,
    sort: filters.sort,
  })}`;
}

function resolveActiveCategoryGroup(filters: CatalogListFilters): string {
  const category = filters.category?.trim() ?? "";
  if (category.length === 0) {
    return "";
  }
  if (isDenaliMarketingCategoryGroup(category)) {
    return category;
  }
  if (category.startsWith("mountain_")) {
    return "mountain";
  }
  if (category.startsWith("nature_")) {
    return "nature";
  }
  return category;
}

function formatDifficultyOptionLabel(
  level: number,
  translate: (key: string, values?: Record<string, string | number>) => string
): string {
  return translate("list.filters.difficultyOption", {
    level,
    max: DENALI_MARKETING_DIFFICULTY_MAX,
  });
}

export async function CatalogTourFilterBar({
  filters,
  options,
  showCityFilter,
  defaultCity = "",
  serverListFilters = [],
  pluginId,
}: CatalogTourFilterBarProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const listPath = resolveMarketingLocalePath("/tours", locale);
  const formAction = listPath;
  const activeCategoryGroup = resolveActiveCategoryGroup(filters);
  const filtersActive = catalogListHasActiveFilters(filters, serverListFilters);
  const isDenali = isDenaliMarketingPlugin(pluginId);

  return (
    <div data-marketing-catalog-toolbar>
      <div data-marketing-catalog-filter-bar-head>
        <div data-marketing-catalog-filter-bar-title-row>
          <SlidersHorizontal aria-hidden="true" data-marketing-catalog-filter-bar-icon />
          <p data-marketing-catalog-filter-bar-title>{t("list.filters.panelTitle")}</p>
        </div>
        <Link
          href={listPath}
          data-marketing-catalog-clear-filters
          {...(filtersActive ? { "data-marketing-catalog-clear-filters-active": true } : {})}
        >
          <RotateCcw aria-hidden="true" data-marketing-catalog-clear-filters-icon />
          <span>{t("list.filters.reset")}</span>
        </Link>
      </div>

      {isDenali && options.categories.length > 0 ? (
        <div data-marketing-catalog-category-chips>
          <p data-marketing-catalog-filter-section-label>{t("list.filters.categoryLabel")}</p>
          <div data-marketing-catalog-category-chip-row>
            <Link
              href={buildCategoryChipHref(listPath, filters, undefined)}
              data-marketing-catalog-category-chip
              data-marketing-catalog-category-chip-id="all"
              {...(activeCategoryGroup.length === 0
                ? { "data-marketing-catalog-category-chip-active": true }
                : {})}
            >
              {t("list.filters.allCategories")}
            </Link>
            {options.categories.map((category) => (
              <Link
                key={category}
                href={buildCategoryChipHref(listPath, filters, category)}
                data-marketing-catalog-category-chip
                data-marketing-catalog-category-chip-id={category}
                {...(activeCategoryGroup === category
                  ? { "data-marketing-catalog-category-chip-active": true }
                  : {})}
              >
                {resolveMarketingCatalogCategoryFilterLabel(category, t)}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <form data-marketing-catalog-filters method="get" action={formAction}>
        <div data-marketing-catalog-filter-search-row>
          <label data-marketing-catalog-filter-search>
            <span data-marketing-catalog-filter-field-label>{t("list.filters.searchLabel")}</span>
            <span data-marketing-catalog-filter-search-input-wrap>
              <Search aria-hidden="true" data-marketing-catalog-filter-search-icon />
              <input
                type="search"
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder={t("list.filters.searchPlaceholder")}
              />
            </span>
          </label>
        </div>

        <div data-marketing-catalog-filter-fields>
          {showCityFilter ? (
            <label data-marketing-catalog-filter-field>
              <span data-marketing-catalog-filter-field-label>{t("list.cityLabel")}</span>
              <input
                type="text"
                name="city"
                defaultValue={defaultCity}
                placeholder={t("list.cityPlaceholder")}
                autoComplete="address-level2"
              />
            </label>
          ) : null}

          <label data-marketing-catalog-filter-field>
            <span data-marketing-catalog-filter-field-label>{t("list.filters.sortLabel")}</span>
            <select name="sort" defaultValue={filters.sort}>
              <option value="newest">{t("list.filters.sort.newest")}</option>
              <option value="departure_asc">{t("list.filters.sort.departureAsc")}</option>
              <option value="departure_desc">{t("list.filters.sort.departureDesc")}</option>
              <option value="price_asc">{t("list.filters.sort.priceAsc")}</option>
              <option value="price_desc">{t("list.filters.sort.priceDesc")}</option>
              <option value="difficulty_asc">{t("list.filters.sort.difficultyAsc")}</option>
            </select>
          </label>

          {(isDenali || options.difficulties.length > 0 || filters.difficulty != null) && (
            <label data-marketing-catalog-filter-field>
              <span data-marketing-catalog-filter-field-label>{t("list.filters.difficultyLabel")}</span>
              <select
                name="difficulty"
                defaultValue={filters.difficulty != null ? String(filters.difficulty) : ""}
              >
                <option value="">{t("list.filters.all")}</option>
                {(filters.difficulty != null && !options.difficulties.includes(filters.difficulty)
                  ? [filters.difficulty, ...options.difficulties]
                  : options.difficulties
                ).map((level) => (
                  <option key={level} value={String(level)}>
                    {formatDifficultyOptionLabel(level, t)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(isDenali || options.fitnessLevels.length > 0 || (filters.fitness != null && filters.fitness.length > 0)) && (
            <label data-marketing-catalog-filter-field>
              <span data-marketing-catalog-filter-field-label>{t("list.filters.fitnessLabel")}</span>
              <select name="fitness" defaultValue={filters.fitness ?? ""}>
                <option value="">{t("list.filters.all")}</option>
                {(
                  filters.fitness != null &&
                  filters.fitness.length > 0 &&
                  !options.fitnessLevels.includes(filters.fitness)
                    ? [filters.fitness, ...options.fitnessLevels]
                    : options.fitnessLevels
                ).map((level) => {
                  const fitnessKey = `list.filters.fitnessLevels.${level}`;
                  const localized = t(fitnessKey);
                  const fitnessLabel =
                    localized !== fitnessKey ? localized : t("detail.fitness", { level });
                  return (
                    <option key={level} value={level}>
                      {fitnessLabel}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          <label
            data-marketing-catalog-filter-field
            data-marketing-catalog-filter-availability
          >
            <span data-marketing-catalog-filter-field-label>{t("list.filters.availabilityLabel")}</span>
            <span data-marketing-catalog-filter-checkbox-row>
              <input
                type="checkbox"
                name="availability"
                value="open"
                defaultChecked={filters.availability === "open"}
              />
              <span>{t("list.filters.availabilityOpen")}</span>
            </span>
          </label>
        </div>

        {activeCategoryGroup.length > 0 ? (
          <input type="hidden" name="category" value={activeCategoryGroup} />
        ) : null}

        <div data-marketing-catalog-filter-actions>
          <button type="submit" data-marketing-catalog-filter-apply>
            {t("list.filters.apply")}
          </button>
        </div>
      </form>

      {filtersActive ? (
        <div data-marketing-catalog-active-filters>
          <p data-marketing-catalog-filter-section-label>{t("list.filters.activeLabel")}</p>
          <div data-marketing-catalog-active-filter-row>
            {filters.q != null && filters.q.length > 0 ? (
              <Link
                href={buildCatalogListQueryWithoutFilters(filters, ["q"])}
                data-marketing-catalog-active-filter
                data-marketing-catalog-active-filter-id="q"
              >
                {t("list.searchActive", { query: filters.q })}
              </Link>
            ) : null}
            {activeCategoryGroup.length > 0 ? (
              <Link
                href={buildCatalogListQueryWithoutFilters(filters, ["category"])}
                data-marketing-catalog-active-filter
                data-marketing-catalog-active-filter-id="category"
              >
                {t("list.categoryActive", {
                  category: resolveMarketingCatalogCategoryFilterLabel(activeCategoryGroup, t),
                })}
              </Link>
            ) : null}
            {filters.difficulty != null ? (
              <Link
                href={buildCatalogListQueryWithoutFilters(filters, ["difficulty"])}
                data-marketing-catalog-active-filter
                data-marketing-catalog-active-filter-id="difficulty"
              >
                {formatDifficultyOptionLabel(filters.difficulty, t)}
              </Link>
            ) : null}
            {filters.fitness != null && filters.fitness.length > 0 ? (
              <Link
                href={buildCatalogListQueryWithoutFilters(filters, ["fitness"])}
                data-marketing-catalog-active-filter
                data-marketing-catalog-active-filter-id="fitness"
              >
                {(() => {
                  const fitnessKey = `list.filters.fitnessLevels.${filters.fitness}`;
                  const localized = t(fitnessKey);
                  return localized !== fitnessKey
                    ? localized
                    : t("detail.fitness", { level: filters.fitness });
                })()}
              </Link>
            ) : null}
            {filters.availability === "open" ? (
              <Link
                href={buildCatalogListQueryWithoutFilters(filters, ["availability"])}
                data-marketing-catalog-active-filter
                data-marketing-catalog-active-filter-id="availability"
              >
                {t("list.filters.availabilityOpen")}
              </Link>
            ) : null}
            {filters.sort !== "newest" ? (
              <Link
                href={buildCatalogListQueryWithoutFilters(filters, ["sort"])}
                data-marketing-catalog-active-filter
                data-marketing-catalog-active-filter-id="sort"
              >
                {resolveCatalogSortFilterLabel(filters.sort, t)}
              </Link>
            ) : null}
            {filters.city != null && filters.city.length > 0 ? (
              <Link
                href={buildCatalogListQueryWithoutFilters(filters, ["city"])}
                data-marketing-catalog-active-filter
                data-marketing-catalog-active-filter-id="city"
              >
                {t("list.cityActive", { city: filters.city })}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
