/** Next.js cache tag for tenant catalog payloads. */
export function buildMarketingCatalogCacheTag(tenantId: string): string {
  const id = tenantId.trim();
  if (id.length === 0) {
    throw new Error("MARKETING_CATALOG_TENANT_ID_REQUIRED");
  }
  return `marketing-catalog-${id}`;
}

/** Next.js cache tag for tenant SEO routes (sitemap, robots). */
export function buildMarketingSeoCacheTag(tenantId: string): string {
  const id = tenantId.trim();
  if (id.length === 0) {
    throw new Error("MARKETING_SEO_TENANT_ID_REQUIRED");
  }
  return `marketing-seo-${id}`;
}

/** Next.js fetch revalidate for catalog upstream (seconds). `0` = no time revalidate. */
export function resolveCatalogRevalidateSeconds(): number {
  const raw = process.env.MARKETING_CATALOG_REVALIDATE_SECONDS?.trim();
  if (raw === undefined || raw.length === 0) {
    return 60;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 60;
  }
  return parsed;
}

export function resolveCatalogFetchCache(): RequestInit["cache"] | undefined {
  return resolveCatalogRevalidateSeconds() === 0 ? "no-store" : undefined;
}

export function resolveCatalogFetchNext(tenantId: string): { revalidate?: number; tags: string[] } {
  const tags = [buildMarketingCatalogCacheTag(tenantId), buildMarketingSeoCacheTag(tenantId)];
  const seconds = resolveCatalogRevalidateSeconds();
  if (seconds > 0) {
    return { revalidate: seconds, tags };
  }
  return { tags };
}
