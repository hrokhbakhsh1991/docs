import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { formatLocalizedNumber } from "../src/i18n/format-localized-digits";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function formatLightboxCounter(
  current: number,
  total: number,
  locale: "fa" | "en"
): string {
  const currentLabel = formatLocalizedNumber(current, locale, { useGrouping: false });
  const totalLabel = formatLocalizedNumber(total, locale, { useGrouping: false });
  return locale === "fa"
    ? `${currentLabel} از ${totalLabel}`
    : `${currentLabel} of ${totalLabel}`;
}

describe("marketing-l10n-digits", () => {
  it("MKT-L10N-01 lightbox counter localizes fa/en including edges", () => {
    const lightbox = readRepo("apps/marketing/src/catalog/catalog-tour-detail-photo-lightbox.tsx");
    const faCatalog = readRepo("apps/marketing/messages/fa/catalog.json");
    const enCatalog = readRepo("apps/marketing/messages/en/catalog.json");

    assert.match(lightbox, /t\("detail\.gallery\.lightboxCounter",\s*\{\s*current:/);
    assert.match(faCatalog, /"lightboxCounter": "\{current, number\} از \{total, number\}"/);
    assert.match(enCatalog, /"lightboxCounter": "\{current, number\} of \{total, number\}"/);
    assert.doesNotMatch(lightbox, /labels\.counter/);

    assert.equal(formatLightboxCounter(3, 12, "fa"), "۳ از ۱۲");
    assert.equal(formatLightboxCounter(3, 12, "en"), "3 of 12");
    assert.equal(formatLightboxCounter(1, 5, "fa"), "۱ از ۵");
    assert.equal(formatLightboxCounter(5, 5, "fa"), "۵ از ۵");
    assert.equal(formatLightboxCounter(1, 1, "fa"), "۱ از ۱");
    assert.equal(formatLightboxCounter(1, 1, "en"), "1 of 1");
  });

  it("MKT-L10N-02 membership discount percent uses ICU number placeholders", () => {
    const ui = readRepo("apps/marketing/src/catalog/catalog-commercial-pricing.tsx");
    const faCatalog = readRepo("apps/marketing/messages/fa/catalog.json");
    const enCatalog = readRepo("apps/marketing/messages/en/catalog.json");

    assert.match(faCatalog, /"membershipDiscount": "تخفیف عضویت \{percent, number\}٪"/);
    assert.match(faCatalog, /"membershipDiscountCompact": "\{percent, number\}٪ تخفیف عضویت"/);
    assert.match(enCatalog, /"membershipDiscount": "Membership discount \{percent, number\}%"/);
    assert.match(ui, /pricing\.membershipDiscountCompact/);
    assert.match(ui, /pricing\.membershipDiscount/);
    assert.match(ui, /preview\.memberDiscountPercentage/);

    assert.equal(formatLocalizedNumber(20, "fa", { useGrouping: false }), "۲۰");
    assert.equal(formatLocalizedNumber(20, "en", { useGrouping: false }), "20");
  });

  it("FAQ-L10N-01 home FAQ avoids embedded English fitness/difficulty terms", () => {
    const faCatalog = readRepo("apps/marketing/messages/fa/catalog.json");
    assert.match(faCatalog, /توان بدنی و درجه سختی/);
    assert.doesNotMatch(faCatalog, /fitness و difficulty/);
  });
});
