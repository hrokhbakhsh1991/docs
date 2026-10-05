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
    paymentCollection: () => "Free / no payment required",
    registrationApproval: (mode: "manual" | "auto") => `Approval: ${mode}`,
    prepayment: (percent: number) => `Prepayment ${percent}%`,
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
      paymentPlan: { prepaymentPercent: 30 },
      transport: { mode: "bus" },
    } satisfies MarketingCatalogCard;

    const items = buildCatalogRegisterPreviewItems({
      tour,
      labels,
      paymentModeLabel: "Offline receipt",
    });

    assert.deepEqual(
      items.map((item) => item.id),
      ["national-id", "birth-date", "minimum-age", "transport-intake", "payment-mode", "prepayment"]
    );
  });

  it("BUG-STG-008/013 exposes payment collection and approval policy", () => {
    const tour = {
      id: "tour-policy",
      title: "Policy tour",
      shortDescription: null,
      category: null,
      departureAt: "2026-07-01T08:00:00.000Z",
      endAt: null,
      priceAmount: null,
      priceCurrency: "IRR",
      coverImageUrl: null,
      totalCapacity: null,
      paymentMode: "offline_receipt",
      paymentCollection: "free",
      registrationApproval: "auto",
    } satisfies MarketingCatalogCard;

    const items = buildCatalogRegisterPreviewItems({
      tour,
      labels,
      paymentModeLabel: "Offline receipt",
    });

    assert.deepEqual(
      items.filter(
        (item) => item.id === "payment-collection" || item.id === "registration-approval"
      ),
      [
        { id: "payment-collection", text: "Free / no payment required" },
        { id: "registration-approval", text: "Approval: auto" },
      ]
    );
    assert.equal(
      items.some((item) => item.id === "payment-mode"),
      false,
      "free tours must not advertise a receipt/payment method"
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
    assert.equal(
      buildCatalogRegisterPreviewItems({ tour, labels, paymentModeLabel: null }).length,
      0
    );
  });
});
