import { Mountain, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";
import { resolveGuestChromeDisplayName } from "@app-tour/guest-surface-host";

export type HomeTrustProps = {
  readonly branding: PublicTenantBrandingSnapshot;
};

export async function HomeTrust({ branding }: HomeTrustProps) {
  const t = await getTranslations("catalog");
  const siteName = resolveGuestChromeDisplayName(branding.displayName, t("nav.defaultSiteName"));

  return (
    <section data-marketing-home-trust>
      {branding.logoUrl ? (
        <img src={branding.logoUrl} alt="" data-marketing-logo height={48} width={48} />
      ) : (
        <Mountain aria-hidden="true" data-marketing-home-trust-brand-icon />
      )}
      <ShieldCheck aria-hidden="true" data-marketing-home-trust-shield-icon />
      <p>{t("home.full.trust.tagline")}</p>
      <span data-marketing-home-trust-brand>{siteName}</span>
    </section>
  );
}
