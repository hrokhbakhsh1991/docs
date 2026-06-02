import assert from "node:assert/strict";
import test from "node:test";
import { WorkspaceRole } from "@repo/shared";
import type { CatalogPricingSnapshot } from "./contracts/catalog-pricing-snapshot.dto";
import { calculateQuote } from "./calculate-quote";
import type { PricingLineItem } from "../../pricing/pricing.types";

const tenantId = "11111111-1111-4111-8111-111111111111";
const tourId = "22222222-2222-4222-8222-222222222222";
const departureId = "33333333-3333-4333-8333-333333333333";
const productId = "44444444-4444-4444-8444-444444444444";

test("calculateQuote (finance): admin + PCT10 + catalog promo-gated row — parity math", () => {
  const snapshot: CatalogPricingSnapshot = {
    tour: {
      id: tourId,
      tenantId,
      tourDepartureId: departureId,
      tourProductId: productId,
      listPriceMinor: null,
      currencyCode: null,
      quoteListFallbackMinor: "50000",
      quoteListFallbackCurrency: "USD"
    },
    departure: {
      id: departureId,
      tenantId,
      tourProductId: productId,
      listPriceMinor: "100000",
      currencyCode: "usd"
    },
    prices: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        tourDepartureId: departureId,
        priceType: "base",
        amountMinor: "100000",
        currencyCode: "USD",
        conditionsJson: null
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        tourDepartureId: departureId,
        priceType: "addon",
        amountMinor: "-5000",
        currencyCode: "USD",
        conditionsJson: { promoCode: "pct10" }
      }
    ]
  };

  const quote = calculateQuote(
    {
      tenantId,
      tourId,
      departureId,
      userRole: WorkspaceRole.Admin,
      discountCode: "pct10"
    },
    snapshot
  );

  // base 100000 - staff 3000 (3%) - promo PCT10 10000 - catalog gated -5000 = 82000
  assert.equal(quote.total_minor, "82000");
  assert.equal(quote.currency_code, "USD");
  assert.ok(quote.line_items.some((l: PricingLineItem) => l.line_id === "base:list"));
  assert.ok(quote.line_items.some((l: PricingLineItem) => l.line_id === "adj:workspace_staff"));
  assert.ok(quote.line_items.some((l: PricingLineItem) => l.line_id === "promo:PCT10"));
  assert.ok(quote.line_items.some((l: PricingLineItem) => l.line_id.startsWith("catalog:")));
  assert.match(quote.pricing_rule_version, /^fp-finance-0\.1\.0:[a-f0-9]{16}$/);
});

test("calculateQuote (finance): pure — same inputs ⇒ identical quote", () => {
  const snapshot: CatalogPricingSnapshot = {
    tour: {
      id: tourId,
      tenantId,
      tourDepartureId: departureId,
      tourProductId: productId,
      listPriceMinor: "80000",
      currencyCode: "EUR",
      quoteListFallbackMinor: null,
      quoteListFallbackCurrency: "EUR"
    },
    departure: {
      id: departureId,
      tenantId,
      tourProductId: productId,
      listPriceMinor: null,
      currencyCode: null
    },
    prices: []
  };

  const ctx = {
    tenantId,
    tourId,
    departureId,
    userRole: WorkspaceRole.Viewer,
    discountCode: null
  };

  const a = calculateQuote(ctx, snapshot);
  const b = calculateQuote(ctx, snapshot);
  assert.deepEqual(a, b);
  assert.equal(a.total_minor, "80000");
  assert.equal(a.currency_code, "EUR");
});
