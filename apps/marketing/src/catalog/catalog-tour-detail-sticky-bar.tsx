import { getLocale, getTranslations } from "next-intl/server";

import type { MarketingCatalogCard } from "./catalog-types";
import { CatalogTourDetailRegisterCta } from "./catalog-tour-detail-register-cta";
import { formatCatalogPrice, shouldShowCatalogPrice } from "./format-catalog-display";
import type { CatalogTourRegistrationState } from "./resolve-catalog-tour-registration-state";
import type { MarketingTourDetailCtaModel } from "./resolve-marketing-tour-detail-cta";
import { isAppLocale, resolveIntlDateLocale, type AppLocale } from "@/i18n/routing";

export type CatalogTourDetailStickyBarProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
  readonly registration: CatalogTourRegistrationState;
  readonly cta: MarketingTourDetailCtaModel;
};

export async function CatalogTourDetailStickyBar({
  tour,
  pluginId,
  registration,
  cta,
}: CatalogTourDetailStickyBarProps) {
  if (cta.primaryHref == null && !registration.isSoldOut) {
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

  return (
    <div data-marketing-catalog-detail-sticky-bar>
      {priceLine != null ? (
        <span data-marketing-catalog-detail-sticky-price>{priceLine}</span>
      ) : null}
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
