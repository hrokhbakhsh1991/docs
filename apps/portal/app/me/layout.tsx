import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import { MemberLogoutButton } from "./member-logout-button";

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

  const t = await getTranslations("portalMember.nav");

  return (
    <div data-portal-member-shell className="mx-auto max-w-3xl px-4 py-8">
      <nav className="mb-6 flex flex-wrap items-center gap-4 text-sm">
        <Link href="/me/registrations">{t("registrations")}</Link>
        <Link href="/me/profile">{t("profile")}</Link>
        <MemberLogoutButton />
      </nav>
      {children}
    </div>
  );
}
