import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CatalogTourListItem } from "@/catalog/catalog-tour-list-item";
import { fetchCatalogList } from "@/catalog/fetch-catalog-list";
import { buildMarketingToursListMetadata } from "@/seo/build-marketing-metadata";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { resolveMarketingBootstrapForHost } from "@/tenant/resolve-marketing-bootstrap";

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

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const branding = await fetchPublicTenantBrandingForHost(host);
  const t = await getTranslations("catalog");
  const siteName = branding.displayName ?? t("nav.defaultSiteName");
  const title = `${siteName} — ${t("nav.tours")}`;
  return buildMarketingToursListMetadata({
    host,
    siteName,
    title,
    description: t("metadata.listDescription", { siteName }),
  });
}

export default async function MarketingToursPage({ searchParams }: PageProps) {
  const { cursor, city } = await searchParams;
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const bootstrap = await resolveMarketingBootstrapForHost(host);
  const t = await getTranslations("catalog");
  const { items, nextCursor } = await fetchCatalogList({
    ...bootstrap,
    cursor,
    city,
    limit: DEFAULT_PAGE_LIMIT,
  });

  return (
    <main data-marketing-catalog>
      <h1>{t("list.title")}</h1>
      {bootstrap.pluginId === "urban" ? (
        <form method="get" data-marketing-city-filter>
          <label htmlFor="city">{t("list.cityLabel")}</label>
          <input id="city" name="city" type="search" defaultValue={city ?? ""} placeholder={t("list.cityPlaceholder")} />
          <button type="submit">{t("list.applyFilter")}</button>
          {city ? (
            <Link href="/tours" data-marketing-city-clear>
              {t("list.clearFilter")}
            </Link>
          ) : null}
        </form>
      ) : null}
      {items.length === 0 ? (
        <p data-marketing-catalog-empty>{t("list.empty")}</p>
      ) : (
        <ul data-marketing-catalog-grid>
          {items.map((tour) => (
            <CatalogTourListItem key={tour.id} tour={tour} pluginId={bootstrap.pluginId} />
          ))}
        </ul>
      )}
      {nextCursor ? (
        <p data-marketing-catalog-pagination>
          <Link href={`/tours${buildToursQuery({ city, cursor: nextCursor })}`}>{t("list.loadMore")}</Link>
        </p>
      ) : null}
    </main>
  );
}
