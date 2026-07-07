import type { CatalogListFilters } from "./catalog-list-query";
import {
  catalogListSupportsServerFilter,
  resolveCatalogListFeatures,
} from "@app-tour/workspace-sdk";

/** Build upstream catalog list query — shared by server fetch + marketing BFF (PR-22). */
export function buildCatalogListFetchQuery(input: {
  readonly pluginId: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly city?: string;
  readonly filters?: CatalogListFilters;
}): URLSearchParams {
  const listFeatures = resolveCatalogListFeatures(input.pluginId);
  const query = new URLSearchParams();

  if (input.cursor !== undefined && input.cursor.trim().length > 0) {
    query.set("cursor", input.cursor.trim());
  }
  if (input.limit !== undefined) {
    query.set("limit", String(input.limit));
  }
  if (
    listFeatures.cityFilter &&
    input.city !== undefined &&
    input.city.trim().length > 0
  ) {
    query.set("city", input.city.trim());
  }

  const filters = input.filters;
  if (filters != null) {
    if (
      catalogListSupportsServerFilter(listFeatures, "q") &&
      filters.q != null &&
      filters.q.length > 0
    ) {
      query.set("q", filters.q);
    }
    if (
      catalogListSupportsServerFilter(listFeatures, "category") &&
      filters.category != null &&
      filters.category.length > 0
    ) {
      query.set("category", filters.category);
    }
    if (
      catalogListSupportsServerFilter(listFeatures, "difficulty") &&
      filters.difficulty != null
    ) {
      query.set("difficulty", String(filters.difficulty));
    }
    if (
      catalogListSupportsServerFilter(listFeatures, "fitness") &&
      filters.fitness != null &&
      filters.fitness.length > 0
    ) {
      query.set("fitness", filters.fitness);
    }
    if (
      catalogListSupportsServerFilter(listFeatures, "availability") &&
      filters.availability === "open"
    ) {
      query.set("availability", "open");
    }
    if (
      catalogListSupportsServerFilter(listFeatures, "sort") &&
      filters.sort !== "newest"
    ) {
      query.set("sort", filters.sort);
    }
  }

  return query;
}
