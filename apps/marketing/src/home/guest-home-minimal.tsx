import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";
import { resolveGuestChromeDisplayName } from "@app-tour/guest-surface-host";
import { isAppLocale, resolveMarketingToursListPath, type AppLocale } from "@/i18n/routing";

export type GuestHomeMinimalProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly landing: GuestLandingFeatures;
};

export async function GuestHomeMinimal({ branding }: GuestHomeMinimalProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const toursHref = resolveMarketingToursListPath(locale);
  const siteName = resolveGuestChromeDisplayName(branding.displayName, t("nav.defaultSiteName"));

  return (
    <div data-marketing-home>
      <h1 data-marketing-home-title>{t("home.minimal.title", { siteName })}</h1>
      <p data-marketing-home-lead>{t("home.minimal.lead")}</p>
      <Link href={toursHref} data-marketing-home-cta>
        {t("home.minimal.cta")}
      </Link>
    </div>
  );
}
