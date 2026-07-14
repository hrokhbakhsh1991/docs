import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { isSafePortalReturnPath } from "@app-tour/catalog-registration-flow-ui";
import { isMemberPortalEnabled } from "@app-tour/workspace-sdk";
import {
  resolveMemberLoginCatalogTourId,
  resolvePortalMemberLoginPath,
  resolvePortalMemberModuleUrl,
} from "@app-tour/guest-surface-host";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { fetchCatalogTour } from "@/catalog/fetch-catalog-tour";
import { PortalAuthExperienceShell } from "@/catalog/portal-auth-experience-shell";
import { resolvePortalLoginBackHref } from "@/marketing/resolve-portal-registration-back-href.server";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import { PublicCatalogRegistrationFlow } from "../catalog/[tourId]/register/public-catalog-registration-flow";

export const dynamic = "force-dynamic";

type PageProps = {
  readonly searchParams: Promise<{ readonly portalReturn?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalogRegistration");
  return { title: t("loginPageTitle"), robots: { index: false, follow: false } };
}

export default async function PortalMemberLoginPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const host = await readPortalIngressHost();
  const bootstrap = await resolvePortalBootstrapForHost(host);

  if (!isMemberPortalEnabled(bootstrap.pluginId)) {
    notFound();
  }

  if (!isSafePortalReturnPath(query.portalReturn)) {
    const canonical =
      resolvePortalMemberLoginPath(host) ?? "/login?portalReturn=%2Fme%2Fregistrations";
    redirect(canonical);
  }

  const portalReturn = query.portalReturn.trim();

  const session = await readPublicCatalogSessionFromCookies();
  if (session !== null) {
    redirect(portalReturn);
  }

  const branding = await fetchPublicTenantBrandingForHost(host);
  const backHref = resolvePortalLoginBackHref(host);
  const memberModuleHref = resolvePortalMemberModuleUrl(host);
  const t = await getTranslations("catalogRegistration");

  const tourId = resolveMemberLoginCatalogTourId(bootstrap.pluginId);
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
    <PortalAuthExperienceShell
      branding={branding}
      backHref={backHref}
      heroTitle={t("loginPageTitle")}
      heroLede={t("phone.loginDescription")}
      memberLoginEgress
      pageKind="login"
      workspace={workspace}
      mainAttributes={{ "data-portal-return": portalReturn }}
    >
      <PublicCatalogRegistrationFlow
        workspace={workspace}
        tenantId={bootstrap.tenantId}
        tourId={tourId}
        tourTitle={tourTitle}
        tourPoliciesText={null}
        tourPriceAmount={null}
        tourTransport={tour.transport}
        tourNationalIdRequired={false}
        tourFatherNameRequired={false}
        tourBirthDateRequired={false}
        backHref={backHref}
        memberModuleHref={memberModuleHref}
      />
    </PortalAuthExperienceShell>
  );
}
