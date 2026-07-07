/**
 * Optional search-engine sitemap ping after catalog publish (SEO-5++ T-089).
 * No-op unless MARKETING_SITEMAP_PING_URL is set.
 */
export function scheduleMarketingSitemapPing(sitemapUrl: string): void {
  const endpoint = process.env.MARKETING_SITEMAP_PING_URL?.trim();
  if (endpoint === undefined || endpoint.length === 0) {
    return;
  }

  const normalizedSitemap = sitemapUrl.trim();
  if (normalizedSitemap.length === 0) {
    return;
  }

  const pingUrl = endpoint.includes("{url}")
    ? endpoint.replace("{url}", encodeURIComponent(normalizedSitemap))
    : `${endpoint}${endpoint.includes("?") ? "&" : "?"}url=${encodeURIComponent(normalizedSitemap)}`;

  void fetch(pingUrl, { method: "GET" }).catch(() => {
    // fire-and-forget accelerator
  });
}
