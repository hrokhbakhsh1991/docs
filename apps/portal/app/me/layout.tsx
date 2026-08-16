import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { guestVisibleProfileMobile } from "@app-tour/catalog-registration-auth";
import { resolveEmbeddedMemberPortalHost, resolveGuestChromeDisplayName } from "@app-tour/guest-surface-host";
import { isMemberPortalEnabled } from "@app-tour/workspace-sdk";
import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { fetchMemberProfile } from "@/me/fetch-member-profile.server";
import { MemberPortalDisabled } from "@/me/member-portal-disabled";
import { resolveMarketingPublicBaseUrl } from "@/marketing/resolve-marketing-public-url";
import { resolveMemberEntitlementsForShell } from "@/me/resolve-member-entitlements-for-shell.server";
import { PortalMemberShell } from "@/shell/portal-member-shell";
import { resolvePortalMemberNavForPlugin } from "@/shell/resolve-portal-member-nav.server";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function MeLayout({ children }: { children: ReactNode }) {
  const host = await readPortalIngressHost();
  const session = await readPublicCatalogSessionFromCookies();
  if (session === null) {
    redirect("/");
  }

  const bootstrap = await resolvePortalBootstrapForHost(host);
  if (session.tenantId !== bootstrap.tenantId) {
    redirect("/");
  }
  if (!isMemberPortalEnabled(bootstrap.pluginId)) {
    return <MemberPortalDisabled />;
  }

  const branding = await fetchPublicTenantBrandingForHost(host);
  const tChrome = await getTranslations("catalogRegistration");
  const workspaceLabel = resolveGuestChromeDisplayName(
    branding.displayName,
    tChrome("chrome.defaultSiteName")
  );
  const logoUrl = branding.logoUrl ?? null;
  const entitlements = await resolveMemberEntitlementsForShell(host, bootstrap);
  const grantedEntitlementKeys = entitlements?.granted ?? [];
  const { bottomNav } = resolvePortalMemberNavForPlugin(
    bootstrap.pluginId,
    grantedEntitlementKeys
  );
  const requestHeaders = await headers();
  const embeddedHost = resolveEmbeddedMemberPortalHost({
    userAgent: requestHeaders.get("user-agent"),
  });

  const profilePayload = await fetchMemberProfile(host);
  const profile = profilePayload?.profile;
  const tNav = await getTranslations("portalMember.nav");
  const memberHeader = {
    displayName:
      profile?.fields.displayName?.trim() ||
      guestVisibleProfileMobile(profile?.fields.mobile) ||
      tNav("memberFallback"),
    avatarUrl: profile?.fields.avatarUrl ?? null,
    profileHref: "/me/profile",
  };

  return (
    <PortalMemberShell
      workspaceLabel={workspaceLabel}
      logoUrl={logoUrl}
      bottomNav={bottomNav}
      marketingHomeUrl={resolveMarketingPublicBaseUrl(host)}
      memberHeader={memberHeader}
      embeddedHost={embeddedHost}
    >
      {children}
    </PortalMemberShell>
  );
}
