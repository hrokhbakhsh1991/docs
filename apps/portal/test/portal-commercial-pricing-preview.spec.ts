import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("portal-commercial-pricing-preview", () => {
  it("PREVIEW-UX-01 forwards authenticated member headers to authoritative API", () => {
    const route = readRepo("apps/portal/app/api/catalog/pricing-preview/route.ts");
    assert.match(route, /buildMemberApiHeaders/);
    assert.match(route, /Authorization === undefined/);
    assert.match(route, /\/catalog\/pricing-preview/);
    assert.doesNotMatch(route, /permanentDiscountPercentage/);
  });

  it("PREVIEW-UX-02 Denali UI renders server preview fields, not client discount math", () => {
    const source = readRepo(
      "packages/workspaces/denali/src/catalog/registration-flow/denali-registration-flow.steps.tsx"
    );
    assert.match(source, /data-registration-pricing-preview/);
    assert.match(source, /data-registration-pricing-gross/);
    assert.match(source, /data-registration-pricing-discount/);
    assert.match(source, /data-registration-pricing-payable/);
    assert.match(
      source,
      /commercialPricingPreviews\[pricingPreviewKey\(input\.target, input\.transportKind\)\]/
    );
    assert.match(source, /registrantTarget: input\.target/);
    assert.match(source, /preview\.memberDiscountMinor/);
    assert.match(source, /participantPricingInputs/);
    assert.doesNotMatch(source, /0\.8|80 \/ 100|memberDiscountPercentage \*|\/ 100/);
  });

  it("PREVIEW-UX-03 API preview is read-only and shares Finance quote reducer", () => {
    const route = readRepo("apps/api/src/catalog/commercial-pricing-preview.routes.ts");
    assert.match(route, /buildCommercialQuoteFreezeInput/);
    assert.match(route, /IdentityMembershipDiscountReadAdapter/);
    assert.match(route, /readTourAllowMembershipDiscount/);
    assert.doesNotMatch(
      route,
      /financeCommercialQuote\.create|createVersion|ensureFrozenForMoneyPath/
    );
    assert.match(route, /readRegistrantTarget/);
    assert.match(route, /registrantTarget === "self"/);
  });

  it("PREVIEW-UX-04 labels organized transport fees without implying a car", () => {
    const fa = readRepo("apps/portal/messages/fa/catalogRegistration.json");
    const en = readRepo("apps/portal/messages/en/catalogRegistration.json");
    assert.match(fa, /تخفیف عضویت/);
    assert.match(fa, /قیمت برای شما/);
    assert.match(fa, /"transport":\s*"هزینه حمل‌ونقل"/);
    assert.match(fa, /دنگ خودرو/);
    assert.match(en, /"transport":\s*"Transport fee"/);
  });
});
