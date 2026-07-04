import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";

export type GuestHomeMinimalProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly landing: GuestLandingFeatures;
};

export async function GuestHomeMinimal({ branding }: GuestHomeMinimalProps) {
  const t = await getTranslations("catalog");
  const siteName = branding.displayName ?? t("nav.defaultSiteName");

  return (
    <main data-marketing-home>
      <h1 data-marketing-home-title>{t("home.minimal.title", { siteName })}</h1>
      <p data-marketing-home-lead>{t("home.minimal.lead")}</p>
      <Link href="/tours" data-marketing-home-cta>
        {t("home.minimal.cta")}
      </Link>
    </main>
  );
}
