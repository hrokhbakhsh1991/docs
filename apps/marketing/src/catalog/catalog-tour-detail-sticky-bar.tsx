"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

import type { MarketingCatalogCard } from "./catalog-types";
import { formatCatalogPrice, shouldShowCatalogPrice } from "./format-catalog-display";
import type { CatalogTourRegistrationState } from "./resolve-catalog-tour-registration-state";
import { isAppLocale, resolveIntlDateLocale, type AppLocale } from "@/i18n/routing";

export type CatalogTourDetailStickyBarProps = {
  readonly tour: MarketingCatalogCard;
  readonly registration: CatalogTourRegistrationState;
  readonly tourSignInUrl?: string | null;
  readonly embeddedRegistrationUrl?: string | null;
  readonly embeddedTourSignInUrl?: string | null;
};

export function CatalogTourDetailStickyBar({
  tour,
  registration,
  tourSignInUrl = null,
  embeddedRegistrationUrl = null,
  embeddedTourSignInUrl = null,
}: CatalogTourDetailStickyBarProps) {
  const t = useTranslations("catalog");
  const localeRaw = useLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);

  if (!registration.canRegister && !registration.isSoldOut) {
    return null;
  }

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
        <>
          <a
            href={registration.registrationUrl}
            data-marketing-register
            {...(embeddedRegistrationUrl != null && embeddedRegistrationUrl.trim().length > 0
              ? {
                  "data-marketing-dialog-src": embeddedRegistrationUrl,
                  "data-marketing-dialog-title": t("detail.registrationDialog.registerTitle"),
                }
              : {})}
          >
            {t("detail.register")}
          </a>
          {tourSignInUrl != null && tourSignInUrl.trim().length > 0 ? (
            <a
              href={tourSignInUrl}
              data-marketing-tour-sign-in
              {...(embeddedTourSignInUrl != null && embeddedTourSignInUrl.trim().length > 0
                ? {
                    "data-marketing-dialog-src": embeddedTourSignInUrl,
                    "data-marketing-dialog-title": t("detail.registrationDialog.signInTitle"),
                  }
                : {})}
            >
              {t("detail.signInToRegister")}
            </a>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
