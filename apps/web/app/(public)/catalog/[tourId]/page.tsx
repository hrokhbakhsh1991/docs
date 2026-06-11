import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { resolveMarketingTourDetailUrl } from "@/marketing/resolve-marketing-public-url";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly params: Promise<{ readonly tourId: string }>;
};

/** Urban tour detail — redirected to apps/marketing (M2b). Registration stays on web. */
export default async function UrbanCatalogTourRedirectPage({ params }: PageProps) {
  const { tourId } = await params;
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  redirect(resolveMarketingTourDetailUrl(host, tourId));
}
