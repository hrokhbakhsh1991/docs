import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

import type { MarketingCatalogCard } from "@/catalog/catalog-types";
import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";

import { GuestHomeFull } from "./guest-home-full";
import { GuestHomeMinimal } from "./guest-home-minimal";

export type RenderHomePageInput = {
  readonly landing: GuestLandingFeatures;
  readonly branding: PublicTenantBrandingSnapshot;
  readonly catalogItems: readonly MarketingCatalogCard[];
  readonly pluginId: string;
  readonly host: string;
};

export function renderHomePage(input: RenderHomePageInput) {
  if (input.landing.variant === "full") {
    return (
      <GuestHomeFull
        landing={input.landing}
        branding={input.branding}
        catalogItems={input.catalogItems}
        pluginId={input.pluginId}
        host={input.host}
      />
    );
  }

  return <GuestHomeMinimal branding={input.branding} landing={input.landing} />;
}
