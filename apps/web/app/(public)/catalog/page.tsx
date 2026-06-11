import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { resolveMarketingToursUrl } from "@/marketing/resolve-marketing-public-url";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly searchParams: Promise<{ readonly cursor?: string }>;
};

/** Urban public catalog — redirected to apps/marketing (M2b). */
export default async function UrbanCatalogRedirectPage({ searchParams }: PageProps) {
  const { cursor } = await searchParams;
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  redirect(resolveMarketingToursUrl(host, cursor));
}
