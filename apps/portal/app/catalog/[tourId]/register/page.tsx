import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { supportsCatalogRegistration } from "@app-tour/workspace-sdk";
import type { FlowRuntimeState } from "@app-tour/workspace-sdk";
import { fetchCatalogTour } from "@/catalog/fetch-catalog-tour";
import { buildRegistrationResumeInitialState } from "@/catalog/build-registration-resume-initial-state.server";
import { resolveMarketingTourDetailUrl } from "@/marketing/resolve-marketing-public-url";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalMemberModuleUrl } from "@app-tour/guest-surface-host";

import { PublicCatalogRegistrationFlow } from "./public-catalog-registration-flow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type PageProps = {
  readonly params: Promise<{ readonly tourId: string }>;
};

export default async function CatalogRegisterPage({ params }: PageProps) {
  const { tourId } = await params;
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const backHref = resolveMarketingTourDetailUrl(host, tourId);
  const memberModuleHref = resolvePortalMemberModuleUrl(host);
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

  const registrationContext = {
    pluginId: workspace,
    tenantId: bootstrap.tenantId,
    tourId,
    tourTitle,
    tourPoliciesText: tour.policiesText ?? null,
    tourPriceAmount: tour.priceAmount ?? null,
    tourTransport: tour.transport,
    tourRequirements: {
      nationalIdRequired: tour.nationalIdRequired === true,
      fatherNameRequired: tour.fatherNameRequired === true,
      birthDateRequired: tour.birthDateRequired === true,
    },
    backHref,
    memberModuleHref,
  };

  const resumeInitialState: FlowRuntimeState | null = await buildRegistrationResumeInitialState(
    host,
    bootstrap.tenantId,
    registrationContext
  );

  return (
    <main
      data-catalog-registration-page
      data-workspace={workspace}
      {...(resumeInitialState !== null ? { "data-registration-resume": "intake" } : {})}
    >
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
        memberModuleHref={memberModuleHref}
        initialRuntimeState={resumeInitialState ?? undefined}
      />
      <p>
        <a href={backHref}>{t("backToTour")}</a>
      </p>
    </main>
  );
}
