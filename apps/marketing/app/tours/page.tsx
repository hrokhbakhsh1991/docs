import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { CatalogTourList } from "@/catalog/catalog-tour-list";
import { CatalogCityFilterForm } from "@/catalog/catalog-city-filter-form";
import { fetchCatalogList } from "@/catalog/fetch-catalog-list";
import { isAppLocale, routing } from "@/i18n/routing";
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

const DEFAULT_PAGE_LIMIT = 20;

type PageProps = {
  readonly searchParams: Promise<{ readonly cursor?: string; readonly city?: string }>;
};

function buildToursQuery(input: { readonly cursor?: string; readonly city?: string }): string {
  const query = new URLSearchParams();
  if (input.city !== undefined && input.city.trim().length > 0) {
    query.set("city", input.city.trim());
  }
  if (input.cursor !== undefined && input.cursor.trim().length > 0) {
    query.set("cursor", input.cursor.trim());
  }
  const serialized = query.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const [{ cursor, city }, headerList, localeRaw] = await Promise.all([
    searchParams,
    headers(),
    getLocale(),
  ]);
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
    { cursor, city },
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
  const { cursor, city } = await searchParams;
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const bootstrap = await resolveMarketingBootstrapForHost(host);
  const listFeatures = resolveCatalogListFeatures(bootstrap.pluginId);
  const t = await getTranslations("catalog");
  const { items, nextCursor } = await fetchCatalogList({
    ...bootstrap,
    cursor,
    city,
    limit: DEFAULT_PAGE_LIMIT,
  });
  const listJsonLd =
    shouldEmitMarketingCatalogListJsonLd({ cursor }) && items.length > 0
      ? buildMarketingCatalogListJsonLd({
          host,
          listLabel: t("list.title"),
          items: items.map((item) => ({
            tourId: item.id,
            title: item.title?.trim() || t("detail.defaultTourTitle"),
          })),
        })
      : null;

  return (
    <main data-marketing-catalog>
      <header data-marketing-catalog-header>
        <h1 data-marketing-catalog-title>{t("list.title")}</h1>
      </header>
      {listFeatures.cityFilter ? (
        <CatalogCityFilterForm
          defaultCity={city ?? ""}
          cityLabel={t("list.cityLabel")}
          cityPlaceholder={t("list.cityPlaceholder")}
          applyLabel={t("list.applyFilter")}
          clearLabel={t("list.clearFilter")}
          showClear={city != null && city.trim().length > 0}
        />
      ) : null}
      {items.length === 0 ? (
        <p data-marketing-catalog-empty>{t("list.empty")}</p>
      ) : (
        <CatalogTourList items={items} pluginId={bootstrap.pluginId} />
      )}
      {nextCursor ? (
        <nav data-marketing-catalog-pagination>
          <Link href={`/tours${buildToursQuery({ city, cursor: nextCursor })}`}>{t("list.loadMore")}</Link>
        </nav>
      ) : null}
      {listJsonLd != null ? (
        <script
          type="application/ld+json"
          data-marketing-catalog-list-jsonld
          dangerouslySetInnerHTML={{ __html: serializeMarketingJsonLd(listJsonLd) }}
        />
      ) : null}
    </main>
  );
}
