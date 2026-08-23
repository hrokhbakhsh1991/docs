import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { isSafePortalReturnPath } from "@app-tour/catalog-registration-flow-ui";
import { isMemberPortalEnabled } from "@app-tour/workspace-sdk";
import {
  resolveMemberLoginCatalogTourId,
  resolvePortalMemberLoginPath,
  resolvePortalMemberModuleUrl,
  resolveGuestChromeDisplayName,
} from "@app-tour/guest-surface-host";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { PortalLoginThinHost } from "@/auth/portal-login-thin-host";
import { PortalAuthExperienceShell } from "@/catalog/portal-auth-experience-shell";
import { fetchCatalogTour } from "@/catalog/fetch-catalog-tour";
import { resolvePortalLoginBackHref } from "@/marketing/resolve-portal-registration-back-href.server";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { sessionMemberMatchesPortalGuestSurface } from "@/tenant/session-host-binding";

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
    sessionMemberMatchesPortalGuestSurface(session.tenantId, host, bootstrap.tenantId)
  ) {
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
  // Smoke tour id bootstraps the OTP page flow plugin only. Some operator smoke
  // tenants may lack the member-login catalog tour — do not 404.
  const tourTitle =
    tour?.title?.trim() ||
    resolveGuestChromeDisplayName(branding.displayName, t("chrome.defaultSiteName"));
  const workspace = bootstrap.pluginId;
  const loginFlow = {
    workspace,
    tenantId: bootstrap.tenantId,
    tourId,
    tourTitle,
    backHref,
    memberModuleHref,
  };

  return (
    <PortalAuthExperienceShell
      branding={branding}
      backHref={backHref}
      heroTitle={t("phone.loginTitle")}
      sessionBadge={null}
      memberLoginEgress
      pageKind="login"
      workspace={workspace}
      mainAttributes={{
        "data-portal-return": portalReturn,
        "data-portal-login-full-page": "",
      }}
    >
      <PortalLoginThinHost flow={loginFlow} portalReturn={portalReturn} />
    </PortalAuthExperienceShell>
  );
}
