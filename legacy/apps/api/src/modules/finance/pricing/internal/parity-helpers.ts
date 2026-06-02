import { BadRequestException } from "@nestjs/common";
import type {
  CatalogDeparturePricingSnapshot,
  CatalogPricingSnapshot,
  CatalogTourPriceRowSnapshot,
  CatalogTourPricingSnapshot
} from "../contracts/catalog-pricing-snapshot.dto";
import type { PricingLineItem } from "../../../pricing/pricing.types";

/**
 * Canonical finance pricing rules bundle id (bump when rule semantics change).
 * Prefix for persisted `pricing_rule_version` / fingerprint hashes from {@link calculateQuote}.
 * Historical quotes may still carry the retired `fp-shadow-0.1.0:` prefix.
 */
export const FINANCE_PRICING_RULES_ID = "fp-finance-0.1.0";

/** Must match `TourPriceType.BASE` in tours module (`"base"`). */
const CATALOG_PRICE_TYPE_BASE = "base";

export function assertDepartureBelongsToTourSnapshot(
  tour: CatalogTourPricingSnapshot,
  departure: CatalogDeparturePricingSnapshot
): void {
  const effectiveDepartureId = tour.tourDepartureId ?? tour.id;
  if (effectiveDepartureId !== departure.id) {
    throw new BadRequestException({
      error: {
        code: "PRICING_TOUR_DEPARTURE_MISMATCH",
        message: "Departure is not bookable for this tour"
      }
    });
  }
  if (
    tour.tourProductId &&
    departure.tourProductId &&
    tour.tourProductId !== departure.tourProductId
  ) {
    throw new BadRequestException({
      error: {
        code: "PRICING_TOUR_DEPARTURE_MISMATCH",
        message: "Departure product does not match tour product"
      }
    });
  }
}

export function resolveBaseMinorAndCurrencyFromCatalog(
  catalog: CatalogPricingSnapshot
): { baseMinor: bigint; currency: string } {
  const { tour, departure, prices } = catalog;
  const baseRow = prices.find((p) => p.priceType === CATALOG_PRICE_TYPE_BASE);
  if (baseRow) {
    return { baseMinor: BigInt(baseRow.amountMinor), currency: baseRow.currencyCode.toUpperCase() };
  }
  if (departure.listPriceMinor) {
    const c = (departure.currencyCode ?? "USD").toUpperCase();
    return { baseMinor: BigInt(departure.listPriceMinor), currency: c.slice(0, 3) };
  }
  if (tour.quoteListFallbackMinor) {
    return {
      baseMinor: BigInt(tour.quoteListFallbackMinor),
      currency: tour.quoteListFallbackCurrency.toUpperCase().slice(0, 3)
    };
  }
  if (tour.listPriceMinor) {
    const c = (tour.currencyCode ?? tour.quoteListFallbackCurrency ?? "USD").toUpperCase();
    return { baseMinor: BigInt(tour.listPriceMinor), currency: c.slice(0, 3) };
  }
  throw new BadRequestException({
    error: {
      code: "PRICING_BASE_UNAVAILABLE",
      message: "No list price is configured for this departure"
    }
  });
}

export function normalizeDiscountCode(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const t = raw.trim().toUpperCase();
  return t.length === 0 ? null : t;
}

export function sumLineMinor(lineItems: Pick<PricingLineItem, "amount_minor">[]): bigint {
  let t = 0n;
  for (const li of lineItems) {
    t += BigInt(li.amount_minor);
  }
  return t;
}

export function catalogExtraLinesForDiscount(
  prices: readonly CatalogTourPriceRowSnapshot[],
  discountCode: string | null
): PricingLineItem[] {
  const lines: PricingLineItem[] = [];
  for (const row of prices) {
    if (row.priceType === CATALOG_PRICE_TYPE_BASE) {
      continue;
    }
    const cond = row.conditionsJson as { promoCode?: string } | null | undefined;
    const required = typeof cond?.promoCode === "string" ? cond.promoCode.trim().toUpperCase() : null;
    if (required && discountCode && required === discountCode) {
      lines.push({
        line_id: `catalog:${row.id}`,
        kind: "tour_price_catalog",
        description: `Catalog ${row.priceType}`,
        amount_minor: row.amountMinor,
        currency_code: row.currencyCode.toUpperCase(),
        meta: { tour_price_id: row.id, price_type: row.priceType }
      });
    }
  }
  return lines;
}
