import type { CatalogListSort } from "./catalog-list-query";
import type { MarketingCatalogCard } from "./catalog-types";

function readTimestamp(value: string | null | undefined): number | null {
  if (value == null || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function compareNullableNumbers(a: number | null, b: number | null): number {
  if (a == null && b == null) {
    return 0;
  }
  if (a == null) {
    return 1;
  }
  if (b == null) {
    return -1;
  }
  return a - b;
}

/** Client-side sort on the current fetched batch (PR-21). */
export function sortMarketingCatalogItems(
  items: readonly MarketingCatalogCard[],
  sort: CatalogListSort
): readonly MarketingCatalogCard[] {
  if (sort === "newest") {
    return items;
  }

  const sorted = [...items];

  switch (sort) {
    case "departure_asc":
      sorted.sort((left, right) =>
        compareNullableNumbers(
          readTimestamp(left.departureAt ?? left.startDate ?? null),
          readTimestamp(right.departureAt ?? right.startDate ?? null)
        )
      );
      break;
    case "departure_desc":
      sorted.sort((left, right) =>
        compareNullableNumbers(
          readTimestamp(right.departureAt ?? right.startDate ?? null),
          readTimestamp(left.departureAt ?? left.startDate ?? null)
        )
      );
      break;
    case "price_asc":
      sorted.sort((left, right) =>
        compareNullableNumbers(left.priceAmount ?? null, right.priceAmount ?? null)
      );
      break;
    case "price_desc":
      sorted.sort((left, right) =>
        compareNullableNumbers(right.priceAmount ?? null, left.priceAmount ?? null)
      );
      break;
    case "difficulty_asc":
      sorted.sort((left, right) =>
        compareNullableNumbers(left.difficultyLevel ?? null, right.difficultyLevel ?? null)
      );
      break;
    default:
      break;
  }

  return sorted;
}
