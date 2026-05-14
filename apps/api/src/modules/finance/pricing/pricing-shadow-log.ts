import type { Logger } from "@nestjs/common";
import type { PricingQuoteResult } from "../../pricing/pricing.types";
import type { PricingQuote } from "./pricing-quote";

/**
 * Emits a single structured log line when legacy catalog pricing is compared to the authoritative finance engine.
 */
export function logPricingShadowDiff(
  logger: Pick<Logger, "log">,
  payload: {
    tenant_id: string;
    tour_id: string;
    departure_id: string;
    legacy: PricingQuoteResult;
    finance: PricingQuote;
  }
): void {
  const legacyMinor = BigInt(payload.legacy.total);
  const financeMinor = BigInt(payload.finance.total_minor);
  const delta = legacyMinor - financeMinor;
  logger.log(
    JSON.stringify({
      event: "PRICING_SHADOW_DIFF",
      tenant_id: payload.tenant_id,
      tour_id: payload.tour_id,
      departure_id: payload.departure_id,
      legacy_total_minor: payload.legacy.total,
      finance_total_minor: payload.finance.total_minor,
      currency: payload.legacy.currency_code,
      totals_match: legacyMinor === financeMinor,
      delta_minor: delta.toString(),
      legacy_pricing_version: payload.legacy.pricing_version,
      legacy_pricing_rule_version: payload.legacy.pricing_rule_version,
      finance_pricing_rule_version: payload.finance.pricing_rule_version,
      legacy_line_count: payload.legacy.line_items.length,
      finance_line_count: payload.finance.line_items.length
    })
  );
}
