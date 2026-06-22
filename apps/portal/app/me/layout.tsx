import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";

export default async function MeLayout({ children }: { children: ReactNode }) {
  const session = await readPublicCatalogSessionFromCookies();
  if (session === null) {
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
