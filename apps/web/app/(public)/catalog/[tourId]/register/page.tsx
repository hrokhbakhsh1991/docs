import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { resolvePortalRegistrationRedirectUrl } from "@/portal/resolve-portal-registration-redirect";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly params: Promise<{ readonly tourId: string }>;
};

/** DEC-P11-014 — web shim redirects public registration to apps/portal. */
export default async function CatalogRegisterRedirectPage({ params }: PageProps) {
  const { tourId } = await params;
  const host = (await headers()).get("host") ?? "localhost:3000";
  redirect(resolvePortalRegistrationRedirectUrl(host, tourId));
}
