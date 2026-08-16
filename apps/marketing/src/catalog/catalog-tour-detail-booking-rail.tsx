import { getLocale, getTranslations } from "next-intl/server";

import type { MarketingCatalogCard } from "./catalog-types";
import { formatCatalogPrice, shouldShowCatalogPrice } from "./format-catalog-display";
import { CatalogTourDetailRegisterCta } from "./catalog-tour-detail-register-cta";
import type { CatalogTourRegistrationState } from "./resolve-catalog-tour-registration-state";
import { isAppLocale, resolveIntlDateLocale, type AppLocale } from "@/i18n/routing";

export type CatalogTourDetailBookingRailProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
  readonly registration: CatalogTourRegistrationState;
  readonly tourSignInUrl?: string | null;
};

export async function CatalogTourDetailBookingRail({
  tour,
  pluginId,
  registration,
  tourSignInUrl = null,
}: CatalogTourDetailBookingRailProps) {
  if (!registration.canRegister && !registration.isSoldOut) {
    return null;
  }

  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const priceLine = shouldShowCatalogPrice(tour)
    ? formatCatalogPrice(
        tour.priceAmount,
        tour.priceCurrency,
        dateLocale,
        t("detail.priceOnRequest"),
        pluginId,
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
      {...(registration.canRegister ? { id: "catalog-detail-register" } : {})}
    >
      {priceLine != null ? (
        <p data-marketing-catalog-detail-rail-price>{priceLine}</p>
      ) : null}
      {capacityLine != null ? (
        <p data-marketing-catalog-detail-rail-capacity>{capacityLine}</p>
      ) : null}
      <CatalogTourDetailRegisterCta
        registration={registration}
        variant="rail"
        tourSignInUrl={tourSignInUrl}
      />
    </aside>
  );
}
