import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCatalogRegisterPreviewItems,
  tourHasRegisterPreviewData,
} from "../src/catalog/build-catalog-register-preview-items";
import type { MarketingCatalogCard } from "../src/catalog/catalog-types";

describe("buildCatalogRegisterPreviewItems", () => {
  const labels = {
    nationalId: "National ID",
    fatherName: "Father name",
    birthDate: "Birth date",
    minimumAge: (years: number) => `Min age ${years}`,
    maximumAge: (years: number) => `Max age ${years}`,
    transportIntake: "Transport details",
    payment: (mode: string) => `Pay via ${mode}`,
  };

  it("PR-D-RPV-01 lists intake flags and payment mode from card", () => {
    const tour = {
      id: "tour-1",
      title: "Trek",
      shortDescription: null,
      category: null,
      departureAt: null,
      endAt: null,
      priceAmount: null,
      priceCurrency: "IRR",
      coverImageUrl: null,
      totalCapacity: null,
      nationalIdRequired: true,
      birthDateRequired: true,
      minimumAge: 18,
      paymentMode: "offline_receipt",
      transport: { mode: "bus" },
    } satisfies MarketingCatalogCard;

    const items = buildCatalogRegisterPreviewItems({
      tour,
      labels,
      paymentModeLabel: "Offline receipt",
    });

    assert.deepEqual(
      items.map((item) => item.id),
      ["national-id", "birth-date", "minimum-age", "transport-intake", "payment-mode"],
    );
  });

  it("PR-D-RPV-02 returns empty when no preview data", () => {
    const tour = {
      id: "tour-2",
      title: "Trek",
      shortDescription: null,
      category: null,
      departureAt: null,
      endAt: null,
      priceAmount: null,
      priceCurrency: "IRR",
      coverImageUrl: null,
      totalCapacity: null,
    } satisfies MarketingCatalogCard;

    assert.equal(tourHasRegisterPreviewData(tour), false);
    assert.equal(buildCatalogRegisterPreviewItems({ tour, labels, paymentModeLabel: null }).length, 0);
  });
});
