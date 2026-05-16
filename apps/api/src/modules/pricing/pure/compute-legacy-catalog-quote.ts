import { createHash } from "node:crypto";

import { BadRequestException } from "@nestjs/common";
import { WorkspaceRole } from "@repo/shared";
import type { CatalogPricingSnapshot } from "../../finance/pricing/contracts/catalog-pricing-snapshot.dto";
import { assertSingleCurrency } from "../../finance/pricing/finance-pricing-rules";
import {
  assertDepartureBelongsToTourSnapshot,
  catalogExtraLinesForDiscount,
  normalizeDiscountCode,
  resolveBaseMinorAndCurrencyFromCatalog,
  sumLineMinor
} from "../../finance/pricing/internal/parity-helpers";
import type { PricingEngineInput, PricingLineItem, PricingQuoteResult } from "../pricing.types";

/** Legacy rule bundle id for **read-only / drift** catalog math (must bump when line math changes). */
export const LEGACY_PRICING_ENGINE_RULES_ID = "pe-1.0.0";

/**
 * Pure legacy catalog quote: **input snapshot + engine input → quote**. No database, repositories,
 * HTTP, clocks, or RNG. Callers load {@link CatalogPricingSnapshot} elsewhere (e.g. {@link CatalogPricingLoadPort}).
 *
 * **Production:** not invoked from registration/checkout — only from {@link PricingEngineService} when
 * `FINANCE_LEGACY_PRICING_DIAGNOSTICS=archive` and `NODE_ENV !== "production"` and a caller passes
 * `financeShadowCompare` (read-only drift log vs finance {@link calculateQuote}).
 *
 * **Determinism:** For the same `catalog` and `input`, `line_items`, `total`, `currency_code`,
 * `pricing_version`, and `pricing_rule_version` are identical. Arithmetic uses `bigint` only;
 * the version string is SHA-256 over a JSON object with a fixed key layout. Iteration follows
 * `catalog.prices` order as given (stable quotes assume a stable-ordered snapshot from the loader).
 *
 * **Dependency graph (this module must not import):** TypeORM, Nest data sources, tours/users/settings
 * repositories, or outbound services — only DTOs + shared parity helpers + `BadRequestException`.
 */
export function computeLegacyCatalogQuote(
  input: PricingEngineInput,
  catalog: CatalogPricingSnapshot
): PricingQuoteResult {
  assertDepartureBelongsToTourSnapshot(catalog.tour, catalog.departure);

  const { baseMinor, currency } = resolveBaseMinorAndCurrencyFromCatalog(catalog);
  const discountCode = normalizeDiscountCode(input.discountCode);

  const lineItems: PricingLineItem[] = [
    {
      line_id: "base:list",
      kind: "base",
      description: "List price",
      amount_minor: baseMinor.toString(),
      currency_code: currency
    }
  ];

  const staffBps = staffDiscountBps(input.userRole);
  if (staffBps > 0) {
    const off = (baseMinor * BigInt(staffBps)) / 10000n;
    if (off > 0n) {
      lineItems.push({
        line_id: "adj:workspace_staff",
        kind: "workspace_role_adjustment",
        description: "Workspace staff rate",
        amount_minor: (-off).toString(),
        currency_code: currency,
        meta: { role: input.userRole, bps: staffBps }
      });
    }
  }

  const promoOff = promoDiscountMinor(discountCode, baseMinor);
  if (promoOff > 0n && discountCode) {
    lineItems.push({
      line_id: `promo:${discountCode}`,
      kind: "promo_code",
      description: `Promo ${discountCode}`,
      amount_minor: (-promoOff).toString(),
      currency_code: currency,
      meta: { code: discountCode }
    });
  }

  lineItems.push(...catalogExtraLinesForDiscount(catalog.prices, discountCode));

  assertSingleCurrency(lineItems, currency);

  const totalMinor = sumLineMinor(lineItems);
  if (totalMinor < 0n) {
    throw new BadRequestException({
      error: {
        code: "PRICING_TOTAL_NEGATIVE",
        message: "Discounts exceed list price"
      }
    });
  }

  const total = totalMinor.toString();
  const pricing_version = buildLegacyPricingRuleVersion({
    tenantId: input.tenantId,
    tourId: input.tourId,
    departureId: input.departureId,
    userRole: input.userRole,
    discountCode,
    lineItems,
    total
  });

  return {
    line_items: lineItems,
    total,
    pricing_version,
    pricing_rule_version: pricing_version,
    currency_code: currency
  };
}

function staffDiscountBps(role: WorkspaceRole): number {
  switch (role) {
    case WorkspaceRole.Owner:
    case WorkspaceRole.Leader:
    case WorkspaceRole.Admin:
      return 300;
    default:
      return 0;
  }
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

function buildLegacyPricingRuleVersion(input: {
  tenantId: string;
  tourId: string;
  departureId: string;
  userRole: WorkspaceRole;
  discountCode: string | null;
  lineItems: PricingLineItem[];
  total: string;
}): string {
  const h = createHash("sha256")
    .update(
      JSON.stringify({
        rules: LEGACY_PRICING_ENGINE_RULES_ID,
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
  return `${LEGACY_PRICING_ENGINE_RULES_ID}:${h}`;
}
