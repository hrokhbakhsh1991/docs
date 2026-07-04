import { getLocale, getTranslations } from "next-intl/server";

import type { MarketingCatalogCard } from "./catalog-types";
import { formatCatalogPrice, shouldShowCatalogPrice } from "./format-catalog-display";
import type { CatalogTourRegistrationState } from "./resolve-catalog-tour-registration-state";
import { isAppLocale, resolveIntlDateLocale, type AppLocale } from "@/i18n/routing";

export type CatalogTourDetailStickyBarProps = {
  readonly tour: MarketingCatalogCard;
  readonly registration: CatalogTourRegistrationState;
};

export async function CatalogTourDetailStickyBar({
  tour,
  registration,
}: CatalogTourDetailStickyBarProps) {
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
      )
    : null;

  return (
    <div data-marketing-catalog-detail-sticky-bar>
      {priceLine != null ? (
        <span data-marketing-catalog-detail-sticky-price>{priceLine}</span>
      ) : null}
      {registration.isSoldOut ? (
        <p data-marketing-catalog-detail-sold-out>{t("detail.soldOut")}</p>
      ) : registration.registrationUrl != null ? (
        <a href={registration.registrationUrl} data-marketing-register>
          {t("detail.register")}
        </a>
      ) : null}
    </div>
  );
}
