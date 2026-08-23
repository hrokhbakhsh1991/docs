import { getLocale, getTranslations } from "next-intl/server";

import type { MarketingCatalogCard } from "./catalog-types";
import { CatalogCommercialPricingBreakdown } from "./catalog-commercial-pricing";
import type { MarketingCommercialPricingPreview } from "./commercial-pricing-preview";
import { CatalogTourDetailRegisterCta } from "./catalog-tour-detail-register-cta";
import { formatCatalogPrice, shouldShowCatalogPrice } from "./format-catalog-display";
import type { CatalogTourRegistrationState } from "./resolve-catalog-tour-registration-state";
import type { MarketingTourDetailCtaModel } from "./resolve-marketing-tour-detail-cta";
import { isAppLocale, resolveIntlDateLocale, type AppLocale } from "@/i18n/routing";
import { resolveMarketingCatalogSurface } from "./resolve-marketing-catalog-surface";

export type CatalogTourDetailStickyBarProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
  readonly registration: CatalogTourRegistrationState;
  readonly cta: MarketingTourDetailCtaModel;
  readonly pricingPreview?: MarketingCommercialPricingPreview | null;
};

export async function CatalogTourDetailStickyBar({
  tour,
  pluginId,
  registration,
  cta,
  pricingPreview = null,
}: CatalogTourDetailStickyBarProps) {
  if (cta.primaryHref == null && !registration.isSoldOut) {
    return null;
  }

  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const catalogSurface = await resolveMarketingCatalogSurface(pluginId);
  const priceLine = shouldShowCatalogPrice(tour)
    ? formatCatalogPrice(
        tour.priceAmount,
        tour.priceCurrency,
        dateLocale,
        t("detail.priceOnRequest"),
        catalogSurface
      )
    : null;

  return (
    <div data-marketing-catalog-detail-sticky-bar>
      <CatalogCommercialPricingBreakdown
        preview={pricingPreview}
        canonicalPrice={priceLine}
        dateLocale={dateLocale}
        priceDisplayPolicy={catalogSurface}
        t={t}
        compact
      />
      {registration.isSoldOut && cta.primaryKind !== "view-self" ? (
        <p data-marketing-catalog-detail-sold-out>{t("detail.soldOut")}</p>
      ) : (
        <CatalogTourDetailRegisterCta
          registration={registration}
          cta={cta}
          variant="sticky"
          tourId={tour.id}
          tourTitle={tour.title ?? ""}
        />
      )}
    </div>
  );
}
