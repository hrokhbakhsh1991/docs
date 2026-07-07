import { logger } from "../observability/logger";

import { scheduleMarketingSitemapPing } from "./schedule-marketing-sitemap-ping";

function resolveMarketingRevalidateEndpoint(): { url: string; secret: string; sitemapUrl?: string } | null {
  const baseUrl = process.env.MARKETING_REVALIDATE_URL?.trim();
  const secret = process.env.MARKETING_REVALIDATE_SECRET?.trim();
  if (baseUrl === undefined || baseUrl.length === 0) {
    return null;
  }
  if (secret === undefined || secret.length === 0) {
    return null;
  }
  return {
    url: `${baseUrl.replace(/\/$/, "")}/api/revalidate`,
    secret,
    sitemapUrl: process.env.MARKETING_SITEMAP_URL?.trim(),
  };
}

/**
 * Fire-and-forget marketing cache purge (M11). No-op when env is unset.
 */
export function scheduleMarketingCatalogRevalidate(tenantId: string): void {
  const endpoint = resolveMarketingRevalidateEndpoint();
  if (endpoint === null) {
    return;
  }

  const normalizedTenantId = tenantId.trim();
  if (normalizedTenantId.length === 0) {
    return;
  }

  void fetch(endpoint.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-marketing-revalidate-secret": endpoint.secret,
    },
    body: JSON.stringify({ tenantId: normalizedTenantId }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        logger.warn(
          {
            event: "marketing.catalog.revalidate_failed",
            tenantId: normalizedTenantId,
            status: response.status,
            body: body.slice(0, 200),
          },
          "marketing catalog revalidate returned non-OK status"
        );
        return;
      }

      if (endpoint.sitemapUrl !== undefined && endpoint.sitemapUrl.length > 0) {
        scheduleMarketingSitemapPing(endpoint.sitemapUrl);
      }
    })
    .catch((error: unknown) => {
      logger.warn(
        {
          event: "marketing.catalog.revalidate_failed",
          tenantId: normalizedTenantId,
          error: error instanceof Error ? error.message : String(error),
        },
        "marketing catalog revalidate request failed"
      );
    });
}
