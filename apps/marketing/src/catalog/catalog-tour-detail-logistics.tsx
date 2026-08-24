import { getLocale, getTranslations } from "next-intl/server";

import { isPublicCatalogOrganizedTransportMode } from "@app-tour/workspace-sdk";

import { buildCatalogMapLink } from "./build-catalog-map-link";
import type { MarketingCatalogCard } from "./catalog-types";
import { formatCatalogPrice } from "./format-catalog-display";
import { resolveCatalogTransportLabelKey } from "./resolve-catalog-transport-label-key";
import { resolveCatalogPriceDisplay } from "./resolve-catalog-price-display";
import { isAppLocale, resolveIntlDateLocale, type AppLocale } from "@/i18n/routing";
import { toLocalizedDigits } from "@/i18n/format-localized-digits";

export type CatalogTourDetailLogisticsProps = {
  readonly tour: MarketingCatalogCard;
  readonly pluginId: string;
};

export async function CatalogTourDetailLogistics({
  tour,
  pluginId,
}: CatalogTourDetailLogisticsProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const dateLocale = resolveIntlDateLocale(locale);
  const priceDisplayPolicy = resolveCatalogPriceDisplay(pluginId);
  const transport = tour.transport;
  const gatheringLabel =
    tour.gatheringPoint?.label?.trim() || tour.meetingPointText?.trim() || null;
  const mapLink = buildCatalogMapLink(tour.gatheringPoint);
  const returnTime = tour.approximateReturnTime?.trim() || null;

  const transportMode = transport?.mode;
  const transportLabel =
    transportMode != null && transportMode !== "none"
      ? t(resolveCatalogTransportLabelKey(transportMode))
      : null;
  const transportCost =
    transport != null &&
    transport.transportCostAmount != null &&
    isPublicCatalogOrganizedTransportMode(transport.mode)
      ? formatCatalogPrice(
          transport.transportCostAmount,
          tour.priceCurrency,
          dateLocale,
          t("detail.priceOnRequest"),
          priceDisplayPolicy
        )
      : null;
  const dongAmount =
    transport?.dongAmount != null
      ? formatCatalogPrice(
          transport.dongAmount,
          tour.priceCurrency,
          dateLocale,
          t("detail.priceOnRequest"),
          priceDisplayPolicy
        )
      : null;

  const hasContent =
    gatheringLabel != null ||
    mapLink != null ||
    returnTime != null ||
    transportLabel != null ||
    transportCost != null ||
    dongAmount != null ||
    transport?.allowPersonalCar === true;

  if (!hasContent) {
    return null;
  }

  const localize = (text: string) => toLocalizedDigits(text, locale);

  return (
    <section data-marketing-catalog-detail-logistics id="catalog-detail-logistics">
      <h2>{t("detail.logistics.heading")}</h2>
      <dl data-marketing-catalog-detail-logistics-list>
        {gatheringLabel != null ? (
          <div>
            <dt>{t("detail.logistics.gathering")}</dt>
            <dd>{localize(gatheringLabel)}</dd>
          </div>
        ) : null}
        {mapLink != null ? (
          <div>
            <dt>{t("detail.logistics.map")}</dt>
            <dd>
              <a
                href={mapLink}
                data-marketing-catalog-detail-map-link
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("detail.logistics.openMap")}
              </a>
            </dd>
          </div>
        ) : null}
        {returnTime != null ? (
          <div>
            <dt>{t("detail.logistics.returnTime")}</dt>
            <dd>{localize(returnTime)}</dd>
          </div>
        ) : null}
        {transportLabel != null ? (
          <div>
            <dt>{t("detail.logistics.transport")}</dt>
            <dd>{transportLabel}</dd>
          </div>
        ) : null}
        {transportCost != null ? (
          <div>
            <dt>{t("detail.logistics.transportCost")}</dt>
            <dd>{transportCost}</dd>
          </div>
        ) : null}
        {dongAmount != null ? (
          <div>
            <dt>{t("detail.logistics.dongAmount")}</dt>
            <dd>{dongAmount}</dd>
          </div>
        ) : null}
        {transport?.allowPersonalCar === true ? (
          <div>
            <dt>{t("detail.logistics.personalCar")}</dt>
            <dd>{t("detail.logistics.personalCarAllowed")}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
