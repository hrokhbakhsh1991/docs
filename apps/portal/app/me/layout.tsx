import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { resolveEmbeddedMemberPortalHost } from "@app-tour/guest-surface-host";
import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { PortalMemberShell } from "@/shell/portal-member-shell";
import { resolvePortalMemberNavForPlugin } from "@/shell/resolve-portal-member-nav.server";
import { resolveMemberEntitlementsForShell } from "@/me/resolve-member-entitlements-for-shell.server";
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

  const branding = await fetchPublicTenantBrandingForHost(host);
  const workspaceLabel = branding.displayName?.trim() || bootstrap.pluginId;
  const entitlements = await resolveMemberEntitlementsForShell(host, bootstrap);
  const grantedEntitlementKeys = entitlements?.granted ?? [];
  const { primaryNav, userMenuNav } = resolvePortalMemberNavForPlugin(
    bootstrap.pluginId,
    grantedEntitlementKeys
  );
  const requestHeaders = await headers();
  const embeddedHost = resolveEmbeddedMemberPortalHost({
    userAgent: requestHeaders.get("user-agent"),
  });

  return (
    <PortalMemberShell
      workspaceLabel={workspaceLabel}
      primaryNav={primaryNav}
      userMenuNav={userMenuNav}
      embeddedHost={embeddedHost}
    >
      {children}
    </PortalMemberShell>
  );
}
