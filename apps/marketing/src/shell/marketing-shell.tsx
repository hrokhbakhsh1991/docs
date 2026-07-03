import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { MarketingLocaleSwitcher } from "@/i18n/marketing-locale-switcher";
import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";

export type MarketingShellProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly portalMemberAreaUrl: string;
  readonly children: ReactNode;
};

export async function MarketingShell({
  branding,
  portalMemberAreaUrl,
  children,
}: MarketingShellProps) {
  const t = await getTranslations("catalog");
  const title = branding.displayName ?? t("nav.defaultSiteName");

  return (
    <>
      <header data-marketing-header>
        <Link href="/tours" data-marketing-brand>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" data-marketing-logo height={32} />
          ) : null}
          <span>{title}</span>
        </Link>
        <nav>
          <Link href="/tours">{t("nav.tours")}</Link>
          <a href={portalMemberAreaUrl} data-marketing-portal-member>
            {t("nav.memberArea")}
          </a>
          <MarketingLocaleSwitcher />
        </nav>
      </header>
      {children}
    </>
  );
}
