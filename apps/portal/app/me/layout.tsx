import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { PortalMemberShell } from "@/shell/portal-member-shell";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

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

  return <PortalMemberShell workspaceLabel={workspaceLabel}>{children}</PortalMemberShell>;
}
