import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { supportsCatalogRegistration } from "@app-tour/workspace-sdk";
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

  if (!supportsCatalogRegistration(bootstrap.pluginId)) {
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
        tourPoliciesText={tour.policiesText ?? null}
        tourPriceAmount={tour.priceAmount ?? null}
        tourTransport={tour.transport}
        tourNationalIdRequired={tour.nationalIdRequired === true}
        tourFatherNameRequired={tour.fatherNameRequired === true}
        tourBirthDateRequired={tour.birthDateRequired === true}
        backHref={backHref}
      />
      <p>
        <a href={backHref}>{t("backToTour")}</a>
      </p>
    </main>
  );
}
