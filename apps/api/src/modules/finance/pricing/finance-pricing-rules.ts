import { BadRequestException } from "@nestjs/common";
import type { WorkspaceRole } from "@repo/shared";
import { qualifiesForStaffPricingDiscount } from "../../../common/rbac/workspace-access.helper";
import type { PricingLineItem } from "../../pricing/pricing.types";
import { catalogExtraLinesForDiscount, resolveBaseMinorAndCurrencyFromCatalog } from "./internal/parity-helpers";
import type { FinanceEvaluationState, PricingRule } from "./pricing-rule";

function staffDiscountBps(role: WorkspaceRole): number {
  return qualifiesForStaffPricingDiscount(role) ? 300 : 0;
}

function promoDiscountMinor(code: string | null, baseMinor: bigint): bigint {
  if (!code) {
    return 0n;
  }
  switch (code) {
    case "PCT10":
      return (baseMinor * 10n) / 100n;
    case "SAVE5000":
      return baseMinor >= 50_000n ? 5000n : 0n;
    default:
      return 0n;
  }
}

/**
 * **Tenant** stage — tenant-wide overlays (fees, caps). Parity with legacy: no tenant overlay yet.
 *
 * TODO: Tenant-level coupons / negotiated rate cards.
 * TODO: Seasonal tenant overrides (calendar-bound).
 */
export class TenantNoopRule implements PricingRule {
  readonly stage = "tenant" as const;
  readonly ruleId = "tenant:noop";
  apply(_state: FinanceEvaluationState): void {
    // Intentionally empty — placeholder for future tenant policy.
  }
}

/**
 * **Catalog** stage — authoritative list from tour / departure / `tour_prices` BASE row.
 */
export class CatalogListPriceRule implements PricingRule {
  readonly stage = "catalog" as const;
  readonly ruleId = "catalog:list";
  apply(state: FinanceEvaluationState): void {
    const { baseMinor, currency } = resolveBaseMinorAndCurrencyFromCatalog(state.catalog);
    state.baseMinor = baseMinor;
    state.currency = currency;
    state.lineItems.push({
      line_id: "base:list",
      kind: "base",
      description: "List price",
      amount_minor: baseMinor.toString(),
      currency_code: currency
    });
  }
}

/**
 * **Role** stage — workspace role adjustments (staff rate) off catalog list.
 */
export class RoleWorkspaceStaffRule implements PricingRule {
  readonly stage = "role" as const;
  readonly ruleId = "role:workspace_staff";
  apply(state: FinanceEvaluationState): void {
    const staffBps = staffDiscountBps(state.context.userRole);
    if (staffBps <= 0) {
      return;
    }
    const off = (state.baseMinor * BigInt(staffBps)) / 10000n;
    if (off <= 0n) {
      return;
    }
    state.lineItems.push({
      line_id: "adj:workspace_staff",
      kind: "workspace_role_adjustment",
      description: "Workspace staff rate",
      amount_minor: (-off).toString(),
      currency_code: state.currency,
      meta: { role: state.context.userRole, bps: staffBps }
    });
  }
}

/**
 * **Discount** stage — promo codes + catalog rows gated on promo (mirrors legacy ordering of these effects).
 *
 * **Design integration:** canonical coupon constraints + stacking live under `pricing/discounts/`
 * (`DiscountRule`, `CouponCode`, `evaluateDiscountEligibility`). **Do not** call that helper from here
 * until checkout is explicitly switched — keep parity with legacy promo math for now.
 *
 * TODO: Coupon ledger validation (stacking, redemption limits) — align with `evaluateDiscountEligibility`.
 * TODO: Seasonal / campaign windows independent of promo string.
 * TODO: Dynamic pricing (demand signals).
 * TODO: Surge / capacity-based multipliers.
 */
export class DiscountPromoAndCatalogRule implements PricingRule {
  readonly stage = "discount" as const;
  readonly ruleId = "discount:promo_and_catalog";
  apply(state: FinanceEvaluationState): void {
    const promoOff = promoDiscountMinor(state.discountCode, state.baseMinor);
    if (promoOff > 0n && state.discountCode) {
      state.lineItems.push({
        line_id: `promo:${state.discountCode}`,
        kind: "promo_code",
        description: `Promo ${state.discountCode}`,
        amount_minor: (-promoOff).toString(),
        currency_code: state.currency,
        meta: { code: state.discountCode }
      });
    }
    const extras = catalogExtraLinesForDiscount(state.catalog.prices, state.discountCode);
    state.lineItems.push(...extras);
  }
}

export function assertSingleCurrency(lineItems: PricingLineItem[], currency: string): void {
  for (const li of lineItems) {
    if (li.currency_code !== currency) {
      throw new BadRequestException({
        error: {
          code: "PRICING_CURRENCY_MISMATCH",
          message: "Mixed-currency quotes are not supported"
        }
      });
    }
  }
}
