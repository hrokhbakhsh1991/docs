import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";

import {
  resolveMarketingPublicBaseUrl,
  resolveMarketingToursUrl,
  shouldRedirectCatalogToMarketing,
} from "@/marketing/resolve-marketing-public-url";

import { CatalogMarketingUnavailable } from "./catalog-marketing-unavailable";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly searchParams: Promise<{ readonly cursor?: string }>;
};

/** Public catalog list — redirected to apps/marketing (M2b). */
export default async function CatalogRedirectPage({ searchParams }: PageProps) {
  const { cursor } = await searchParams;
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const marketingBaseUrl = resolveMarketingPublicBaseUrl(host);
  if (!shouldRedirectCatalogToMarketing(host)) {
    return <CatalogMarketingUnavailable marketingBaseUrl={marketingBaseUrl} />;
  }
  permanentRedirect(resolveMarketingToursUrl(host, cursor));
}
