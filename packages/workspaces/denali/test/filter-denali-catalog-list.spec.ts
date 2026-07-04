import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterDenaliCatalogTourRecords,
  parseDenaliCatalogListQuery,
  sortDenaliCatalogTourRecords,
} from "../src/catalog/filter-denali-catalog-list";
import type { DenaliTourRecord } from "../src/http/ports/tour-store.port";

function tour(input: {
  id: string;
  createdAt?: string;
  title?: string;
  category?: string;
  shortDescription?: string;
  difficultyLevel?: number;
  fitnessLevel?: string;
  startDateTime?: string;
  price?: number;
  capacityMax?: number;
}): DenaliTourRecord {
  return {
    id: input.id,
    createdAt: input.createdAt ?? "2026-06-01T00:00:00.000Z",
    canonical: {
      data: {
        title: input.title ?? input.id,
        category: input.category,
        startDateTime: input.startDateTime,
        capacityMax: input.capacityMax,
        program: {
          shortDescription: input.shortDescription,
          difficultyLevel: input.difficultyLevel,
        },
        participants: {
          fitnessLevel: input.fitnessLevel,
        },
        pricing: {
          basePricePerPerson: input.price,
        },
      },
    },
  } as DenaliTourRecord;
}

describe("filter-denali-catalog-list.spec.ts — PR-22", () => {
  const tours = [
    tour({
      id: "1",
      title: "North Ridge",
      category: "mountain_multi",
      difficultyLevel: 4,
      fitnessLevel: "high",
      startDateTime: "2026-08-01T08:00:00.000Z",
      price: 500,
    }),
    tour({
      id: "2",
      title: "Forest Walk",
      category: "nature_day",
      shortDescription: "Woodland trail",
      difficultyLevel: 2,
      fitnessLevel: "low",
      startDateTime: "2026-07-01T08:00:00.000Z",
      price: 200,
    }),
  ];

  it("parses list query params", () => {
    assert.deepEqual(
      parseDenaliCatalogListQuery({
        q: " ridge ",
        category: "mountain_multi",
        difficulty: "4",
        fitness: "high",
        availability: "open",
        sort: "departure_asc",
      }),
      {
        q: "ridge",
        category: "mountain_multi",
        difficulty: 4,
        fitness: "high",
        availability: "open",
        sort: "departure_asc",
      }
    );
  });

  it("filters by category, difficulty, fitness, and q", () => {
    assert.deepEqual(
      filterDenaliCatalogTourRecords(tours, { category: "mountain_multi" }).map((item) => item.id),
      ["1"]
    );
    assert.deepEqual(
      filterDenaliCatalogTourRecords(tours, { category: "mountain" }).map((item) => item.id),
      ["1"]
    );
    assert.deepEqual(
      filterDenaliCatalogTourRecords(tours, { category: "nature" }).map((item) => item.id),
      ["2"]
    );
    assert.deepEqual(
      filterDenaliCatalogTourRecords(tours, { q: "woodland" }).map((item) => item.id),
      ["2"]
    );
    assert.deepEqual(
      filterDenaliCatalogTourRecords(tours, { difficulty: 2, fitness: "low" }).map((item) => item.id),
      ["2"]
    );
  });

  it("sorts by departure ascending", () => {
    assert.deepEqual(
      sortDenaliCatalogTourRecords(tours, "departure_asc").map((item) => item.id),
      ["2", "1"]
    );
  });
});
