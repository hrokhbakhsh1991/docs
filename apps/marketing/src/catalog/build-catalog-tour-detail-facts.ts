import type { CatalogDetailSections } from "@app-tour/workspace-sdk";

import type { MarketingCatalogCard } from "./catalog-types";

export type CatalogTourDetailFact = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly soldOut?: boolean;
};

export type BuildCatalogTourDetailFactsInput = {
  readonly tour: MarketingCatalogCard;
  readonly sections: CatalogDetailSections;
  readonly factLabels: {
    readonly price: string;
    readonly capacity: string;
    readonly dates: string;
    readonly difficulty: string;
    readonly fitness: string;
    readonly category: string;
  };
  readonly priceValue: string | null;
  readonly capacityValue: string | null;
  readonly datesValue: string;
  readonly difficultyValue: string | null;
  readonly fitnessValue: string | null;
  readonly categoryValue: string | null;
  readonly isSoldOut: boolean;
  /** When true, omit dates/category — already shown in detail meta line under title. */
  readonly omitMetaLineDuplicates?: boolean;
};

/** PR-D2 bento cells — price, capacity, dates, difficulty, fitness, category (data-gated). */
export function buildCatalogTourDetailFacts(
  input: BuildCatalogTourDetailFactsInput,
): readonly CatalogTourDetailFact[] {
  const facts: CatalogTourDetailFact[] = [];

  if (input.priceValue != null) {
    facts.push({
      id: "price",
      label: input.factLabels.price,
      value: input.priceValue,
    });
  }

  if (input.capacityValue != null) {
    facts.push({
      id: "capacity",
      label: input.factLabels.capacity,
      value: input.capacityValue,
      ...(input.isSoldOut ? { soldOut: true } : {}),
    });
  }

  if (!input.omitMetaLineDuplicates && input.datesValue.trim().length > 0) {
    facts.push({
      id: "dates",
      label: input.factLabels.dates,
      value: input.datesValue,
    });
  }

  if (input.sections.difficulty && input.difficultyValue != null) {
    facts.push({
      id: "difficulty",
      label: input.factLabels.difficulty,
      value: input.difficultyValue,
    });
  }

  if (input.sections.fitness && input.fitnessValue != null) {
    facts.push({
      id: "fitness",
      label: input.factLabels.fitness,
      value: input.fitnessValue,
    });
  }

  if (!input.omitMetaLineDuplicates && input.categoryValue != null) {
    facts.push({
      id: "category",
      label: input.factLabels.category,
      value: input.categoryValue,
    });
  }

  return Object.freeze(facts);
}
