import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { isSafePortalReturnPath } from "@app-tour/catalog-registration-flow-ui";
import { supportsCatalogRegistration } from "@app-tour/workspace-sdk";
import { fetchCatalogTour } from "@/catalog/fetch-catalog-tour";
import { buildRegistrationResumeInitialState } from "@/catalog/build-registration-resume-initial-state.server";
import { resolvePortalRegistrationBackHref } from "@/marketing/resolve-portal-registration-back-href.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import {
  resolvePortalMemberLoginPath,
  resolvePortalMemberModuleUrl,
} from "@app-tour/guest-surface-host";

import { PortalAuthExperienceShell } from "@/catalog/portal-auth-experience-shell";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { PublicCatalogRegistrationFlow } from "./public-catalog-registration-flow";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly params: Promise<{ readonly tourId: string }>;
  readonly searchParams: Promise<{ readonly portalReturn?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { tourId } = await params;
  const query = await searchParams;
  if (isSafePortalReturnPath(query.portalReturn)) {
    redirect(`/login?portalReturn=${encodeURIComponent(query.portalReturn!.trim())}`);
  }
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const t = await getTranslations("catalogRegistration");

  if (!supportsCatalogRegistration(bootstrap.pluginId)) {
    return { title: t("pageTitle", { tourTitle: tourId }), robots: { index: false, follow: false } };
  }

  const tour = await fetchCatalogTour({
    tenantId: bootstrap.tenantId,
    pluginId: bootstrap.pluginId,
    tourId,
  });

  return {
    title: t("pageTitle", { tourTitle: tour?.title ?? tourId }),
    robots: { index: false, follow: false },
  };
}

export default async function CatalogRegisterPage({ params, searchParams }: PageProps) {
  const { tourId } = await params;
  const query = await searchParams;
  if (isSafePortalReturnPath(query.portalReturn)) {
    redirect(`/login?portalReturn=${encodeURIComponent(query.portalReturn!.trim())}`);
  }
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const backHref = resolvePortalRegistrationBackHref(host, tourId);
  const memberModuleHref = resolvePortalMemberModuleUrl(host);
  const branding = await fetchPublicTenantBrandingForHost(host);
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

  const registrationResume = await buildRegistrationResumeInitialState(
    host,
    bootstrap.tenantId,
    registrationContext
  );

  const resumeAtIntake = registrationResume !== null;
  const heroLede = resumeAtIntake ? t("intake.resumeLede") : t("phone.description");
  const sessionBadge =
    registrationResume !== null && registrationResume.memberMobile !== null
      ? t("intake.signedInBadge", { mobile: registrationResume.memberMobile })
      : null;
  const signInHref = resumeAtIntake
    ? null
    : resolvePortalMemberLoginPath(host, `/catalog/${encodeURIComponent(tourId)}/register`);

  return (
    <PortalAuthExperienceShell
      branding={branding}
      backHref={backHref}
      heroTitle={t("pageTitle", { tourTitle })}
      heroLede={heroLede}
      sessionBadge={sessionBadge}
      pageKind="registration"
      workspace={workspace}
      mainAttributes={resumeAtIntake ? { "data-registration-resume": "intake" } : undefined}
    >
      {signInHref !== null ? (
        <p data-portal-register-sign-in-link>
          <a href={signInHref}>{t("signInToRegister")}</a>
        </p>
      ) : null}
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
        initialRuntimeState={registrationResume?.initialState}
      />
    </PortalAuthExperienceShell>
  );
}
