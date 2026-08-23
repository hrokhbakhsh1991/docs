import type { MarketingCommercialPricingPreview } from "./commercial-pricing-preview";
import { hasMarketingMembershipDiscount } from "./commercial-pricing-preview";
import { formatCatalogPrice, type CatalogPriceDisplayPolicy } from "./format-catalog-display";

type CatalogTranslation = (key: string, values?: Record<string, string | number>) => string;

function parseMinorAmount(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPreviewMinor(
  amountMinor: string,
  currency: string,
  dateLocale: string,
  priceOnRequestLabel: string,
  priceDisplayPolicy: CatalogPriceDisplayPolicy | null
): string | null {
  const amount = parseMinorAmount(amountMinor);
  return amount === null
    ? null
    : formatCatalogPrice(amount, currency, dateLocale, priceOnRequestLabel, priceDisplayPolicy);
}

function ancillaryLabel(code: string, t: CatalogTranslation): string {
  if (code === "transport" || code === "vehicle") {
    return t("pricing.ancillary.transport");
  }
  if (code === "dong") {
    return t("pricing.ancillary.dong");
  }
  return code;
}

export function CatalogCommercialPricingCompact({
  preview,
  canonicalPrice,
  dateLocale,
  priceDisplayPolicy,
  t,
}: {
  readonly preview: MarketingCommercialPricingPreview | null | undefined;
  readonly canonicalPrice: string | null;
  readonly dateLocale: string;
  readonly priceDisplayPolicy: CatalogPriceDisplayPolicy | null;
  readonly t: CatalogTranslation;
}) {
  if (!hasMarketingMembershipDiscount(preview)) {
    return canonicalPrice != null ? (
      <span data-marketing-catalog-card-price>{canonicalPrice}</span>
    ) : null;
  }

  const gross = formatPreviewMinor(
    preview.grossMinor,
    preview.currency,
    dateLocale,
    t("detail.priceOnRequest"),
    priceDisplayPolicy
  );
  const payable = formatPreviewMinor(
    preview.payableMinor,
    preview.currency,
    dateLocale,
    t("detail.priceOnRequest"),
    priceDisplayPolicy
  );
  if (gross === null || payable === null) {
    return canonicalPrice != null ? (
      <span data-marketing-catalog-card-price>{canonicalPrice}</span>
    ) : null;
  }

  return (
    <span data-marketing-catalog-card-member-price>
      <span data-marketing-catalog-card-member-price-original>{gross}</span>
      <span data-marketing-catalog-card-member-price-payable>{payable}</span>
      <span data-marketing-catalog-card-member-price-benefit>
        {t("pricing.membershipDiscountCompact", {
          percent: preview.memberDiscountPercentage,
        })}
      </span>
    </span>
  );
}

export function CatalogCommercialPricingBreakdown({
  preview,
  canonicalPrice,
  dateLocale,
  priceDisplayPolicy,
  t,
  compact = false,
}: {
  readonly preview: MarketingCommercialPricingPreview | null | undefined;
  readonly canonicalPrice: string | null;
  readonly dateLocale: string;
  readonly priceDisplayPolicy: CatalogPriceDisplayPolicy | null;
  readonly t: CatalogTranslation;
  readonly compact?: boolean;
}) {
  if (!hasMarketingMembershipDiscount(preview)) {
    if (compact) {
      return canonicalPrice != null ? (
        <span data-marketing-catalog-detail-sticky-price>{canonicalPrice}</span>
      ) : null;
    }
    return canonicalPrice != null ? (
      <p data-marketing-catalog-detail-rail-price>{canonicalPrice}</p>
    ) : null;
  }

  const gross = formatPreviewMinor(
    preview.grossMinor,
    preview.currency,
    dateLocale,
    t("detail.priceOnRequest"),
    priceDisplayPolicy
  );
  const discount = formatPreviewMinor(
    preview.memberDiscountMinor,
    preview.currency,
    dateLocale,
    t("detail.priceOnRequest"),
    priceDisplayPolicy
  );
  const payable = formatPreviewMinor(
    preview.payableMinor,
    preview.currency,
    dateLocale,
    t("detail.priceOnRequest"),
    priceDisplayPolicy
  );
  if (gross === null || discount === null || payable === null) {
    if (compact) {
      return canonicalPrice != null ? (
        <span data-marketing-catalog-detail-sticky-price>{canonicalPrice}</span>
      ) : null;
    }
    return canonicalPrice != null ? (
      <p data-marketing-catalog-detail-rail-price>{canonicalPrice}</p>
    ) : null;
  }

  const ancillaryLines = preview.lines.filter((line) => line.code !== "trip");

  return (
    <div
      data-marketing-commercial-pricing
      {...(compact ? { "data-marketing-commercial-pricing-compact": true } : {})}
    >
      <div data-marketing-commercial-pricing-row="gross">
        <span>{t("pricing.originalTourPrice")}</span>
        <strong>{gross}</strong>
      </div>
      <div data-marketing-commercial-pricing-row="membership-discount">
        <span>
          {t("pricing.membershipDiscount", {
            percent: preview.memberDiscountPercentage,
          })}
        </span>
        <strong data-marketing-commercial-pricing-discount>-{discount}</strong>
      </div>
      {ancillaryLines.map((line) => {
        const amount = formatPreviewMinor(
          line.amountMinor,
          preview.currency,
          dateLocale,
          t("detail.priceOnRequest"),
          priceDisplayPolicy
        );
        return amount === null ? null : (
          <div
            key={`${line.code}:${line.amountMinor}`}
            data-marketing-commercial-pricing-row="ancillary"
          >
            <span>{ancillaryLabel(line.code, t)}</span>
            <strong>{amount}</strong>
          </div>
        );
      })}
      <div data-marketing-commercial-pricing-row="payable">
        <span>{t("pricing.yourPrice")}</span>
        <strong>{payable}</strong>
      </div>
    </div>
  );
}
