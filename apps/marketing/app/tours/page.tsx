import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { applyMarketingCatalogListPipeline } from "@/catalog/apply-marketing-catalog-list-pipeline";
import { CatalogTourList } from "@/catalog/catalog-tour-list";
import { CatalogTourFilterBar } from "@/catalog/catalog-tour-filter-bar";
import {
  buildCatalogListHref,
  catalogFiltersToNoindexSearchParams,
  catalogListHasActiveFilters,
  catalogListHasClientFilters,
  parseCatalogListFilters,
  resolveCatalogListFetchLimit,
  type CatalogListQueryInputRaw,
} from "@/catalog/catalog-list-query";
import { deriveCatalogFilterOptions } from "@/catalog/derive-catalog-filter-options";
import { fetchCatalogList } from "@/catalog/fetch-catalog-list";
import { isAppLocale, resolveMarketingLocalePath, routing } from "@/i18n/routing";
import { buildMarketingToursListMetadata, shouldNoindexMarketingListPage } from "@/seo/build-marketing-metadata";
import {
  buildMarketingCatalogListJsonLd,
  shouldEmitMarketingCatalogListJsonLd,
} from "@/seo/build-marketing-catalog-list-jsonld";
import { serializeMarketingJsonLd } from "@/seo/serialize-marketing-jsonld";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { resolveMarketingBootstrapForHost } from "@/tenant/resolve-marketing-bootstrap";
import { resolveCatalogListFeatures, resolveGuestSeoForPlugin } from "@app-tour/workspace-sdk";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly searchParams: Promise<CatalogListQueryInputRaw>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const [queryInput, headerList, localeRaw] = await Promise.all([
    searchParams,
    headers(),
    getLocale(),
  ]);
  const filters = parseCatalogListFilters(queryInput);
  const host = headerList.get("host") ?? "localhost:3002";
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const [branding, bootstrap] = await Promise.all([
    fetchPublicTenantBrandingForHost(host),
    resolveMarketingBootstrapForHost(host),
  ]);
  const guestSeo = resolveGuestSeoForPlugin(bootstrap.pluginId).marketing;
  const t = await getTranslations("catalog");
  const siteName = branding.displayName ?? t("nav.defaultSiteName");
  const title = guestSeo.listTitleKey
    ? t(guestSeo.listTitleKey, { siteName })
    : `${siteName} — ${t("nav.tours")}`;
  const description = guestSeo.listDescriptionKey
    ? t(guestSeo.listDescriptionKey, { siteName })
    : t("metadata.listDescription", { siteName });
  const noindex = shouldNoindexMarketingListPage(
    catalogFiltersToNoindexSearchParams(filters),
    guestSeo.pagination?.noindexQueryParams
  );
  return buildMarketingToursListMetadata({
    host,
    siteName,
    title,
    description,
    locale,
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  });
}

export default async function MarketingToursPage({ searchParams }: PageProps) {
  const queryInput = await searchParams;
  const filters = parseCatalogListFilters(queryInput);
  const [headerList, localeRaw] = await Promise.all([headers(), getLocale()]);
  const host = headerList.get("host") ?? "localhost:3002";
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const listPath = resolveMarketingLocalePath("/tours", locale);
  const bootstrap = await resolveMarketingBootstrapForHost(host);
  const listFeatures = resolveCatalogListFeatures(bootstrap.pluginId);
  const serverListFilters = listFeatures.serverListFilters;
  const t = await getTranslations("catalog");
  const clientFiltersActive = catalogListHasClientFilters(filters, serverListFilters);
  const fetchLimit = resolveCatalogListFetchLimit(filters, serverListFilters);
  const { items: fetchedItems, nextCursor } = await fetchCatalogList({
    ...bootstrap,
    cursor: filters.cursor,
    city: filters.city,
    limit: fetchLimit,
    filters,
  });
  const filterOptions = await deriveCatalogFilterOptions({
    pluginId: bootstrap.pluginId,
    items: fetchedItems,
    activeFilters: filters,
  });
  const { items, matchedCount } = await applyMarketingCatalogListPipeline(
    fetchedItems,
    filters,
    serverListFilters,
    bootstrap.pluginId
  );
  const listJsonLd =
    shouldEmitMarketingCatalogListJsonLd({ cursor: filters.cursor }) && items.length > 0
      ? buildMarketingCatalogListJsonLd({
          host,
          listLabel: t("list.title"),
          items: items.map((item) => ({
            tourId: item.id,
            title: item.title?.trim() || t("detail.defaultTourTitle"),
          })),
        })
      : null;
  const loadMoreHref =
    nextCursor != null ? buildCatalogListHref(listPath, filters, nextCursor) : null;
  const firstPageHref =
    filters.cursor != null ? buildCatalogListHref(listPath, filters) : null;
  const isPaginated = filters.cursor != null || nextCursor != null;
  const showFilterScopeNotice = clientFiltersActive && nextCursor != null;
  const resultsLabel = isPaginated
    ? t("list.resultsCountPage", { count: matchedCount })
    : clientFiltersActive
      ? t("list.resultsCountFiltered", { count: matchedCount })
      : t("list.resultsCount", { count: matchedCount });

  return (
    <div data-marketing-catalog data-slot="page-catalog">
      <header data-marketing-catalog-header>
        <h1 data-marketing-catalog-title>{t("list.title")}</h1>
        <p data-marketing-catalog-lead>{t("list.lead")}</p>
      </header>
      <CatalogTourFilterBar
        filters={filters}
        options={filterOptions}
        showCityFilter={listFeatures.cityFilter}
        defaultCity={filters.city ?? ""}
        serverListFilters={serverListFilters}
        pluginId={bootstrap.pluginId}
      />
      {showFilterScopeNotice ? (
        <p data-marketing-catalog-filter-notice role="status">
          {t("list.filterScopeNotice")}
        </p>
      ) : null}
      <p data-marketing-catalog-results role="status">
        {resultsLabel}
      </p>
      {items.length === 0 ? (
        <p data-marketing-catalog-empty>
          {catalogListHasActiveFilters(filters, serverListFilters)
            ? t("list.emptyFiltered")
            : t("list.empty")}
        </p>
      ) : (
        <CatalogTourList items={items} pluginId={bootstrap.pluginId} />
      )}
      {loadMoreHref != null || firstPageHref != null ? (
        <nav data-marketing-catalog-pagination>
          {firstPageHref != null ? (
            <Link href={firstPageHref} data-marketing-catalog-pagination-first>
              {t("list.paginationFirstPage")}
            </Link>
          ) : null}
          {loadMoreHref != null ? (
            <Link href={loadMoreHref} data-marketing-catalog-pagination-next>
              {items.length === 0 && clientFiltersActive
                ? t("list.loadMoreSearch")
                : t("list.loadMore")}
            </Link>
          ) : null}
        </nav>
      ) : null}
      {listJsonLd != null ? (
        <script
          type="application/ld+json"
          data-marketing-catalog-list-jsonld
          dangerouslySetInnerHTML={{ __html: serializeMarketingJsonLd(listJsonLd) }}
        />
      ) : null}
    </div>
  );
}
