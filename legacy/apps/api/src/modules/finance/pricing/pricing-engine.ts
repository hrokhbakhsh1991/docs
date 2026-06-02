import { createHash } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import type { CatalogPricingSnapshot } from "./contracts/catalog-pricing-snapshot.dto";
import type { PricingLineItem } from "../../pricing/pricing.types";
import {
  assertDepartureBelongsToTourSnapshot,
  FINANCE_PRICING_RULES_ID,
  normalizeDiscountCode,
  sumLineMinor
} from "./internal/parity-helpers";
import { assertSingleCurrency } from "./finance-pricing-rules";
import type { PricingContext } from "./pricing-context";
import type { PricingQuote } from "./pricing-quote";
import { PRICING_RULE_STAGE_ORDER, type FinanceEvaluationState, type PricingRule } from "./pricing-rule";
import {
  CatalogListPriceRule,
  DiscountPromoAndCatalogRule,
  RoleWorkspaceStaffRule,
  TenantNoopRule
} from "./finance-pricing-rules";

function buildFinancePricingVersion(input: {
  tenantId: string;
  tourId: string;
  departureId: string;
  userRole: string;
  discountCode: string | null;
  lineItems: PricingLineItem[];
  total: string;
}): string {
  const h = createHash("sha256")
    .update(
      JSON.stringify({
        rules: FINANCE_PRICING_RULES_ID,
        tenantId: input.tenantId,
        tourId: input.tourId,
        departureId: input.departureId,
        userRole: input.userRole,
        discountCode: input.discountCode,
        lines: input.lineItems.map((l) => ({
          id: l.line_id,
          k: l.kind,
          a: l.amount_minor,
          c: l.currency_code
        })),
        total: input.total
      })
    )
    .digest("hex")
    .slice(0, 16);
  return `${FINANCE_PRICING_RULES_ID}:${h}`;
}

/**
 * Finance bounded-context pricing engine. Evaluates {@link PricingRule} instances in fixed stage order:
 * **tenant → catalog → role → discount**.
 *
 * **Determinism guarantee:** For the same {@link PricingContext} and {@link CatalogPricingSnapshot},
 * {@link PricingEngine.evaluate} returns the same {@link PricingQuote} (including `pricing_rule_version`).
 * There is no I/O, wall clock, randomness, or network. Evaluation uses only `bigint` arithmetic and a
 * SHA-256 digest over a JSON payload with a fixed key layout; `catalog.prices` order is part of the input.
 */
export class PricingEngine {
  constructor(private readonly rules: PricingRule[]) {}

  evaluate(context: PricingContext, catalog: CatalogPricingSnapshot): PricingQuote {
    assertDepartureBelongsToTourSnapshot(catalog.tour, catalog.departure);

    const discountCode = normalizeDiscountCode(context.discountCode);

    const state: FinanceEvaluationState = {
      context,
      catalog,
      baseMinor: 0n,
      currency: "",
      discountCode,
      lineItems: []
    };

    for (const stage of PRICING_RULE_STAGE_ORDER) {
      const stageRules = this.rules.filter((r) => r.stage === stage);
      for (const rule of stageRules) {
        rule.apply(state);
      }
    }

    assertSingleCurrency(state.lineItems, state.currency);

    const totalMinor = sumLineMinor(state.lineItems);
    if (totalMinor < 0n) {
      throw new BadRequestException({
        error: {
          code: "PRICING_TOTAL_NEGATIVE",
          message: "Discounts exceed list price"
        }
      });
    }

    const total = totalMinor.toString();
    const pricing_rule_version = buildFinancePricingVersion({
      tenantId: context.tenantId,
      tourId: context.tourId,
      departureId: context.departureId,
      userRole: context.userRole,
      discountCode,
      lineItems: state.lineItems,
      total
    });

    return {
      line_items: state.lineItems,
      total_minor: total,
      currency_code: state.currency,
      pricing_rule_version
    };
  }
}

/** Default finance rule bundle (order fixed in {@link PRICING_RULE_STAGE_ORDER}). */
export function createDefaultFinancePricingEngine(): PricingEngine {
  return new PricingEngine([
    new TenantNoopRule(),
    new CatalogListPriceRule(),
    new RoleWorkspaceStaffRule(),
    new DiscountPromoAndCatalogRule()
  ]);
}
