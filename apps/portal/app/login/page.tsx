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

import { PortalLoginModalOpener } from "@/auth/portal-login-modal-opener";
import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { fetchCatalogTour } from "@/catalog/fetch-catalog-tour";
import { resolvePortalLoginBackHref } from "@/marketing/resolve-portal-registration-back-href.server";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { sessionMemberMatchesPortalTenant } from "@/tenant/session-host-binding";

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

  const portalReturnRaw = query.portalReturn;
  if (!isSafePortalReturnPath(portalReturnRaw)) {
    const canonical =
      resolvePortalMemberLoginPath(host) ?? "/login?portalReturn=%2Fme%2Fregistrations";
    redirect(canonical);
  }

  const portalReturn = portalReturnRaw.trim();

  const session = await readPublicCatalogSessionFromCookies();
  if (
    session !== null &&
    sessionMemberMatchesPortalTenant(session.tenantId, bootstrap.tenantId)
  ) {
    redirect(portalReturn);
  }

  await fetchPublicTenantBrandingForHost(host);
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
    <main
      data-portal-member-login-page
      data-member-login-egress
      data-portal-return={portalReturn}
      data-portal-auth-experience
    >
      <div data-portal-auth-backdrop aria-hidden="true" />
      <div data-portal-login-host-lede>
        <p>{t("phone.loginDescription")}</p>
      </div>
      <PortalLoginModalOpener
        host="login"
        portalReturn={portalReturn}
        flow={{
          workspace,
          tenantId: bootstrap.tenantId,
          tourId,
          tourTitle,
          backHref,
          memberModuleHref,
        }}
      />
    </main>
  );
}
