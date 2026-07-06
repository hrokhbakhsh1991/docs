import { Backpack, ShieldCheck, UserRound, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";

import { HOME_WHY_TILE_IDS, type HomeWhyTileId } from "./home-why-tile-ids";

const WHY_TILE_ICONS: Record<HomeWhyTileId, typeof UserRound> = {
  guide: UserRound,
  safety: ShieldCheck,
  equipment: Backpack,
  community: Users,
};

export type HomeWhyProps = {
  readonly branding: PublicTenantBrandingSnapshot;
};

export async function HomeWhy({ branding }: HomeWhyProps) {
  const t = await getTranslations("catalog");
  const siteName = branding.displayName ?? t("nav.defaultSiteName");
  const copy = { siteName };

  return (
    <section data-marketing-home-why id="why-denali">
      <header>
        <h2>{t("home.full.why.title", copy)}</h2>
        <p>{t("home.full.why.lead")}</p>
      </header>
      <div data-marketing-home-why-grid>
        {HOME_WHY_TILE_IDS.map((id) => {
          const Icon = WHY_TILE_ICONS[id];
          return (
            <article key={id} data-marketing-home-why-tile>
              <Icon aria-hidden="true" data-marketing-home-why-tile-icon />
              <h3>{t(`home.full.why.${id}.title`)}</h3>
              <p>{t(`home.full.why.${id}.description`)}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
