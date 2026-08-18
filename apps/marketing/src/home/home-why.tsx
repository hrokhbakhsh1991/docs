import { UserRound, ShieldCheck, Backpack, Users, Mountain } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";
import { resolveGuestChromeDisplayName } from "@app-tour/guest-surface-host";

import { HOME_WHY_TILE_IDS, type HomeWhyTileId } from "./home-why-tile-ids";

const WHY_ITEM_ICONS: Record<HomeWhyTileId, typeof UserRound> = {
  guide: UserRound,
  safety: ShieldCheck,
  equipment: Backpack,
  community: Users,
};

export type HomeWhyProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly whySectionAnchor: string;
  readonly showTrustKicker?: boolean;
};

export async function HomeWhy({
  branding,
  whySectionAnchor,
  showTrustKicker = false,
}: HomeWhyProps) {
  const t = await getTranslations("catalog");
  const siteName = resolveGuestChromeDisplayName(branding.displayName, t("nav.defaultSiteName"));
  const copy = { siteName };

  return (
    <section data-marketing-home-why data-marketing-home-why-editorial id={whySectionAnchor}>
      <div data-marketing-home-why-inner>
        <header>
          {showTrustKicker ? (
            <div data-marketing-home-why-kicker>
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt=""
                  data-marketing-home-why-kicker-logo
                  height={28}
                  width={28}
                />
              ) : (
                <Mountain aria-hidden="true" data-marketing-home-why-kicker-icon />
              )}
              <span data-marketing-home-why-kicker-brand>{siteName}</span>
              <span data-marketing-home-why-kicker-sep aria-hidden="true">
                ·
              </span>
              <span data-marketing-home-why-kicker-tagline>
                {t("home.full.trust.tagline")}
              </span>
            </div>
          ) : null}
          <h2>{t("home.full.why.title", copy)}</h2>
          <p data-marketing-home-why-lead>{t("home.full.why.lead")}</p>
        </header>
        <ul data-marketing-home-why-rail>
          {HOME_WHY_TILE_IDS.map((id) => {
            const Icon = WHY_ITEM_ICONS[id];
            return (
              <li key={id} data-marketing-home-why-item data-marketing-home-why-item-id={id}>
                <Icon aria-hidden="true" data-marketing-home-why-item-icon />
                <h3>{t(`home.full.why.${id}.title`)}</h3>
                <p>{t(`home.full.why.${id}.description`)}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
