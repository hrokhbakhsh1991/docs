import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { hasMarketingMembershipDiscount } from "../src/catalog/commercial-pricing-preview";
import type { MarketingCommercialPricingPreview } from "../src/catalog/commercial-pricing-preview";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function preview(
  patch: Partial<MarketingCommercialPricingPreview> = {}
): MarketingCommercialPricingPreview {
  return {
    grossMinor: "1000000",
    discountableBaseMinor: "1000000",
    memberDiscountPercentage: 20,
    memberDiscountMinor: "200000",
    payableMinor: "800000",
    currency: "IRR",
    source: "member_discount",
    lines: [{ code: "trip", amountMinor: "1000000" }],
    ...patch,
  };
}

describe("marketing-commercial-pricing-preview", () => {
  it("MKT-MEMBER-PRICE-01 shows personalized benefit only for authoritative member discount", () => {
    assert.equal(hasMarketingMembershipDiscount(preview()), true);
    assert.equal(
      hasMarketingMembershipDiscount(
        preview({
          source: "tour_canonical",
          memberDiscountPercentage: 0,
          memberDiscountMinor: "0",
          payableMinor: "1000000",
        })
      ),
      false
    );
    assert.equal(hasMarketingMembershipDiscount(null), false);
  });

  it("MKT-MEMBER-PRICE-02 list fetch uses one batch preview request, not one request per card", () => {
    const page = readRepo("apps/marketing/app/tours/page.tsx");
    const list = readRepo("apps/marketing/src/catalog/catalog-tour-list.tsx");
    const fetcher = readRepo(
      "apps/marketing/src/catalog/fetch-commercial-pricing-previews.server.ts"
    );

    assert.match(page, /fetchCommercialPricingPreviews/);
    assert.match(page, /tourIds: items\.map/);
    assert.match(list, /pricingPreviews\[tour\.id\]/);
    assert.match(fetcher, /\/catalog\/pricing-previews/);
    assert.match(fetcher, /params\.append\("tourId"/);
    assert.doesNotMatch(list, /fetchCommercialPricingPreview|fetchCommercialPricingPreviews/);
  });

  it("MKT-MEMBER-PRICE-03 anonymous users do not request private pricing", () => {
    const fetcher = readRepo(
      "apps/marketing/src/catalog/fetch-commercial-pricing-previews.server.ts"
    );
    assert.match(fetcher, /headers\.Authorization === undefined/);
    assert.match(fetcher, /return \{\}/);
  });

  it("MKT-MEMBER-PRICE-04 UI renders server fields without client discount arithmetic", () => {
    const ui = readRepo("apps/marketing/src/catalog/catalog-commercial-pricing.tsx");
    assert.match(ui, /preview\.grossMinor/);
    assert.match(ui, /preview\.memberDiscountMinor/);
    assert.match(ui, /preview\.payableMinor/);
    assert.match(ui, /preview\.memberDiscountPercentage/);
    assert.doesNotMatch(ui, /0\.8|80 \/ 100|memberDiscountPercentage \*|\/ 100/);
  });

  it("MKT-MEMBER-PRICE-05 detail and sticky surfaces receive the same preview as the list", () => {
    const detailPage = readRepo("apps/marketing/app/tours/[tourId]/page.tsx");
    const detail = readRepo("apps/marketing/src/catalog/catalog-tour-detail.tsx");
    const rail = readRepo("apps/marketing/src/catalog/catalog-tour-detail-booking-rail.tsx");
    const sticky = readRepo("apps/marketing/src/catalog/catalog-tour-detail-sticky-bar.tsx");

    assert.match(detailPage, /pricingPreview=\{pricingPreviews\[tourId\] \?\? null\}/);
    assert.match(detail, /pricingPreview=\{pricingPreview\}/);
    assert.match(rail, /CatalogCommercialPricingBreakdown/);
    assert.match(sticky, /CatalogCommercialPricingBreakdown/);
  });

  it("MKT-MEMBER-PRICE-06 API batch preview remains read-only and shares Finance reducer", () => {
    const route = readRepo("apps/api/src/catalog/commercial-pricing-preview.routes.ts");
    const app = readRepo("apps/api/src/app.ts");
    assert.match(route, /handleCatalogCommercialPricingPreviews/);
    assert.match(route, /buildCommercialQuoteFreezeInput/);
    assert.match(route, /readTourAllowMembershipDiscount/);
    assert.match(app, /\/catalog\/pricing-previews/);
    assert.doesNotMatch(
      route,
      /financeCommercialQuote\.create|createVersion|ensureFrozenForMoneyPath/
    );
  });

  it("MKT-MEMBER-PRICE-07 copy and theme cover list, detail, and ancillary rows", () => {
    const fa = readRepo("apps/marketing/messages/fa/catalog.json");
    const theme = readRepo("packages/workspaces/denali/theme/marketing/components/26-pr-21-p1.css");
    const railTheme = readRepo(
      "packages/workspaces/denali/theme/marketing/components/03-pr-d6-p2.css"
    );
    assert.match(fa, /تخفیف عضویت/);
    assert.match(fa, /قیمت برای شما/);
    assert.match(fa, /خودرو/);
    assert.match(theme, /data-marketing-catalog-card-member-price/);
    assert.match(railTheme, /data-marketing-commercial-pricing-row="payable"/);
  });
});
