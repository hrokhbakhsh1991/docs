import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCatalogTourDetailFacts } from "../src/catalog/build-catalog-tour-detail-facts";
import { resolveCatalogTourRegistrationState } from "../src/catalog/resolve-catalog-tour-registration-state";
import type { MarketingCatalogCard } from "../src/catalog/catalog-types";

const baseTour: MarketingCatalogCard = {
  id: "tour-1",
  title: "Test",
  shortDescription: null,
  category: "mountain_single_day",
  departureAt: "2026-08-01T06:00:00.000Z",
  endAt: null,
  priceAmount: 2_500_000,
  priceCurrency: "IRR",
  coverImageUrl: null,
  totalCapacity: 12,
  difficultyLevel: 6,
  fitnessLevel: "medium",
};

describe("resolve-catalog-tour-registration-state", () => {
  it("PR-D-REG-01 marks sold out when spotsRemaining is zero", () => {
    const state = resolveCatalogTourRegistrationState(
      { ...baseTour, spotsRemaining: 0 },
      "https://portal.example/register",
    );
    assert.equal(state.isSoldOut, true);
    assert.equal(state.canRegister, false);
  });

  it("PR-D-REG-02 allows register when URL present and seats remain", () => {
    const state = resolveCatalogTourRegistrationState(
      { ...baseTour, spotsRemaining: 3 },
      "https://portal.example/register",
    );
    assert.equal(state.canRegister, true);
  });

  it("PR-D-REG-03 exposes one registrationUrl for all detail CTAs (R-D33)", () => {
    const url = "https://portal.example/catalog/tour-1/register";
    const state = resolveCatalogTourRegistrationState({ ...baseTour, spotsRemaining: 5 }, url);
    assert.equal(state.registrationUrl, url);
    assert.equal(state.canRegister, true);
  });
});

describe("build-catalog-tour-detail-facts", () => {
  const sections = {
    difficulty: true,
    fitness: true,
    itinerary: true,
    policies: true,
  } as const;

  const labels = {
    price: "Price",
    capacity: "Capacity",
    dates: "Dates",
    difficulty: "Difficulty",
    fitness: "Fitness",
    category: "Category",
  };

  it("PR-D-FACTS-01 orders price, capacity, difficulty, fitness when meta line duplicates omitted", () => {
    const facts = buildCatalogTourDetailFacts({
      tour: baseTour,
      sections,
      factLabels: labels,
      priceValue: "IRR 2,500,000",
      capacityValue: "12 spots",
      datesValue: "Aug 1",
      difficultyValue: "6 of 10",
      fitnessValue: "Medium",
      categoryValue: "Mountain hiking",
      isSoldOut: false,
      omitMetaLineDuplicates: true,
    });
    assert.deepEqual(
      facts.map((fact) => fact.id),
      ["price", "capacity", "difficulty", "fitness"],
    );
  });

  it("PR-D-FACTS-01b includes dates and category when meta duplicates allowed", () => {
    const facts = buildCatalogTourDetailFacts({
      tour: baseTour,
      sections,
      factLabels: labels,
      priceValue: "IRR 2,500,000",
      capacityValue: "12 spots",
      datesValue: "Aug 1",
      difficultyValue: "6 of 10",
      fitnessValue: "Medium",
      categoryValue: "Mountain hiking",
      isSoldOut: false,
    });
    assert.deepEqual(
      facts.map((fact) => fact.id),
      ["price", "capacity", "dates", "difficulty", "fitness", "category"],
    );
  });

  it("PR-D-FACTS-02 flags sold-out capacity cell", () => {
    const facts = buildCatalogTourDetailFacts({
      tour: { ...baseTour, spotsRemaining: 0 },
      sections,
      factLabels: labels,
      priceValue: "IRR 2,500,000",
      capacityValue: "0 spots",
      datesValue: "Aug 1",
      difficultyValue: null,
      fitnessValue: null,
      categoryValue: null,
      isSoldOut: true,
    });
    assert.equal(facts.find((fact) => fact.id === "capacity")?.soldOut, true);
  });
});
