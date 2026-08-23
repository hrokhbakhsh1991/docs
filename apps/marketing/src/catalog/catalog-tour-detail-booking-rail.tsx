import { getLocale, getTranslations } from "next-intl/server";

import type { MarketingCatalogCard } from "./catalog-types";
import { CatalogCommercialPricingBreakdown } from "./catalog-commercial-pricing";
import type { MarketingCommercialPricingPreview } from "./commercial-pricing-preview";
import { formatCatalogPrice, shouldShowCatalogPrice } from "./format-catalog-display";
import { CatalogTourDetailRegisterCta } from "./catalog-tour-detail-register-cta";
import type { CatalogTourRegistrationState } from "./resolve-catalog-tour-registration-state";
import type { MarketingTourDetailCtaModel } from "./resolve-marketing-tour-detail-cta";
import { isAppLocale, resolveIntlDateLocale, type AppLocale } from "@/i18n/routing";
import { resolveCatalogPriceDisplay } from "./resolve-catalog-price-display";

export type CatalogTourDetailBookingRailProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
  readonly registration: CatalogTourRegistrationState;
  readonly cta: MarketingTourDetailCtaModel;
  readonly pricingPreview?: MarketingCommercialPricingPreview | null;
};

export async function CatalogTourDetailBookingRail({
  tour,
  pluginId,
  registration,
  cta,
  pricingPreview = null,
}: CatalogTourDetailBookingRailProps) {
  if (cta.primaryHref == null && !registration.isSoldOut) {
    return null;
  }

  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const priceDisplayPolicy = resolveCatalogPriceDisplay(pluginId);
  const priceLine = shouldShowCatalogPrice(tour)
    ? formatCatalogPrice(
        tour.priceAmount,
        tour.priceCurrency,
        dateLocale,
        t("detail.priceOnRequest"),
        priceDisplayPolicy
      )
    : null;

  const capacityLine =
    tour.spotsRemaining != null
      ? t("detail.spotsRemaining", { count: tour.spotsRemaining })
      : tour.totalCapacity != null
        ? t("detail.capacity", { count: tour.totalCapacity })
        : null;

  return (
    <aside
      data-marketing-catalog-detail-booking-rail
      {...(cta.primaryHref != null || registration.canRegister
        ? { id: "catalog-detail-register" }
        : {})}
    >
      <CatalogCommercialPricingBreakdown
        preview={pricingPreview}
        canonicalPrice={priceLine}
        dateLocale={dateLocale}
        priceDisplayPolicy={priceDisplayPolicy}
        t={t}
      />
      {capacityLine != null ? (
        <p data-marketing-catalog-detail-rail-capacity>{capacityLine}</p>
      ) : null}
      <CatalogTourDetailRegisterCta
        registration={registration}
        cta={cta}
        variant="rail"
        tourId={tour.id}
        tourTitle={tour.title ?? ""}
      />
    </aside>
  );
}
