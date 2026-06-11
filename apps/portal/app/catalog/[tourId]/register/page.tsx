import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { fetchCatalogTour } from "@/catalog/fetch-catalog-tour";
import { resolveMarketingTourDetailUrl } from "@/marketing/resolve-marketing-public-url";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import { PublicCatalogRegistrationFlow } from "./public-catalog-registration-flow";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly params: Promise<{ readonly tourId: string }>;
};

export default async function CatalogRegisterPage({ params }: PageProps) {
  const { tourId } = await params;
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3003";
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const backHref = resolveMarketingTourDetailUrl(host, tourId);
  const t = await getTranslations("catalogRegistration");

  if (bootstrap.pluginId !== "denali" && bootstrap.pluginId !== "urban") {
    notFound();
  }

  const tour = await fetchCatalogTour({
    tenantId: bootstrap.tenantId,
    pluginId: bootstrap.pluginId,
    tourId,
  });
  if (tour === null) {
    notFound();
  }

  const tourTitle = tour.title || "Tour";
  const workspace = bootstrap.pluginId;

  return (
    <main data-catalog-registration-page data-workspace={workspace}>
      <h1>{t("pageTitle", { tourTitle })}</h1>
      <PublicCatalogRegistrationFlow
        workspace={workspace}
        tenantId={bootstrap.tenantId}
        tourId={tourId}
        tourTitle={tourTitle}
        backHref={backHref}
      />
      <p>
        <a href={backHref}>{t("backToTour")}</a>
      </p>
    </main>
  );
}
