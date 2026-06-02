import type { PricingLineItem } from "../../pricing/pricing.types";
import type { CatalogPricingSnapshot } from "./contracts/catalog-pricing-snapshot.dto";
import type { PricingContext } from "./pricing-context";

/** Ordered evaluation stages: tenant → catalog → role → discount. */
export type PricingRuleStage = "tenant" | "catalog" | "role" | "discount";

export const PRICING_RULE_STAGE_ORDER: PricingRuleStage[] = [
  "tenant",
  "catalog",
  "role",
  "discount"
];

/**
 * One step in the finance pricing pipeline. Rules are pure functions over {@link FinanceEvaluationState}
 * (append-only line items); the engine passes a fixed {@link CatalogPricingSnapshot} before the first rule runs.
 */
export interface PricingRule {
  readonly stage: PricingRuleStage;
  /** Stable id for logs / diagnostics (e.g. `tenant:noop`). */
  readonly ruleId: string;
  apply(_state: FinanceEvaluationState): void;
}

/** Mutable accumulator while rules run (append-only line pushes). */
export type FinanceEvaluationState = {
  context: PricingContext;
  catalog: CatalogPricingSnapshot;
  /** List reference in minor units (set during catalog stage). */
  baseMinor: bigint;
  currency: string;
  discountCode: string | null;
  lineItems: PricingLineItem[];
};
