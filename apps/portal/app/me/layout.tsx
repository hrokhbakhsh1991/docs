import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export default async function MeLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3003";
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
      <nav className="mb-6 flex gap-4 text-sm">
        <Link href="/me/registrations">{t("registrations")}</Link>
      </nav>
      {children}
    </div>
  );
}
