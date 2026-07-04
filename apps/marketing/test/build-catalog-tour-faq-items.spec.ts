import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCatalogTourFaqItems,
  tourHasAdminCatalogFaqData,
} from "../src/catalog/build-catalog-tour-faq-items";
import type { MarketingCatalogCard } from "../src/catalog/catalog-types";

const baseTour: MarketingCatalogCard = {
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
};

describe("buildCatalogTourFaqItems", () => {
  const staticItems = [
    { id: "q1", question: "Q1", answer: "A1" },
    { id: "q2", question: "Q2", answer: "A2" },
  ] as const;

  it("PR-D-FAQ-01 prefers admin fitness text over static fallback", () => {
    const items = buildCatalogTourFaqItems({
      tour: { ...baseTour, fitnessPrerequisiteText: "Need prior alpine experience" },
      tourLabels: {
        fitnessQuestion: "Fitness?",
        cancellationQuestion: "Cancel?",
      },
      formatCancellationAnswer: () => null,
      staticItems,
    });

    assert.deepEqual(
      items.map((item) => [item.id, item.source]),
      [["fitness-prerequisite", "tour"]],
    );
  });

  it("PR-D-FAQ-02 uses tour cancellation data when admin filled", () => {
    const items = buildCatalogTourFaqItems({
      tour: { ...baseTour, cancellationDeadlineHours: 48, cancellationPenaltyPercentage: 20 },
      tourLabels: {
        fitnessQuestion: "Fitness?",
        cancellationQuestion: "Cancel?",
      },
      formatCancellationAnswer: () => "48h / 20%",
      staticItems,
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, "cancellation");
    assert.equal(items[0]?.source, "tour");
  });

  it("PR-D-FAQ-03 falls back to static when admin FAQ empty", () => {
    const items = buildCatalogTourFaqItems({
      tour: baseTour,
      tourLabels: {
        fitnessQuestion: "Fitness?",
        cancellationQuestion: "Cancel?",
      },
      formatCancellationAnswer: () => null,
      staticItems,
    });

    assert.deepEqual(
      items.map((item) => item.source),
      ["static", "static"],
    );
  });

  it("PR-D-FAQ-04 detects admin FAQ data on card", () => {
    assert.equal(tourHasAdminCatalogFaqData(baseTour), false);
    assert.equal(
      tourHasAdminCatalogFaqData({ ...baseTour, fitnessPrerequisiteText: "Ready" }),
      true,
    );
  });
});
