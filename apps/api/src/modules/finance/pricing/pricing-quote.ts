import type { PricingLineItem } from "../../pricing/pricing.types";

/**
 * Result of {@link calculateQuote} / {@link PricingEngine.evaluate}.
 * Totals are authoritative for registration / checkout flows surfaced through {@link PricingEngineService}.
 */
export type PricingQuote = {
  line_items: PricingLineItem[];
  /** Sum of signed `amount_minor` values (minor units, decimal string). */
  total_minor: string;
  currency_code: string;
  /** Hash of rule bundle + inputs + lines (audit fingerprint). */
  pricing_rule_version: string;
};
