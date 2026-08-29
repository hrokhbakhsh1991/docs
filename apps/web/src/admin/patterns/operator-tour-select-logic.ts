import type { OperatorTourListResponse } from "@/features/tours/operator-tours-types";

import type { OperatorSearchableSelectOption } from "./operator-searchable-select";

export const OPERATOR_TOUR_SELECT_DEFAULT_LIMIT = 25;
export const OPERATOR_TOUR_SELECT_SEARCH_DEBOUNCE_MS = 300;

export type OperatorTourSelectItem = {
  readonly id: string;
  readonly title: string;
  readonly departureAt: string | null;
};

export function buildOperatorTourListUrl(input: {
  readonly search?: string;
  readonly limit?: number;
  readonly page?: number;
  readonly sortBy?: "departure_at" | "title" | "created_at";
  readonly sortDir?: "asc" | "desc";
}): string {
  const params = new URLSearchParams({
    view: "operator",
    limit: String(input.limit ?? OPERATOR_TOUR_SELECT_DEFAULT_LIMIT),
    sort_by: input.sortBy ?? "departure_at",
    sort_dir: input.sortDir ?? "asc",
  });
  if (input.page !== undefined && input.page > 1) {
    params.set("page", String(input.page));
  }
  const search = input.search?.trim();
  if (search !== undefined && search.length > 0) {
    params.set("search", search.slice(0, 200));
  }
  return `/api/tours?${params.toString()}`;
}

export function mapOperatorTourListToSelectItems(
  items: OperatorTourListResponse["items"]
): OperatorTourSelectItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    departureAt: item.departureAt,
  }));
}

export function mapOperatorTourSelectItemsToOptions(
  items: readonly OperatorTourSelectItem[],
  formatDescription?: (item: OperatorTourSelectItem) => string | undefined
): OperatorSearchableSelectOption[] {
  return items.map((item) => ({
    value: item.id,
    label: item.title,
    ...(formatDescription !== undefined
      ? { description: formatDescription(item) }
      : {}),
  }));
}

export function mergeOperatorTourSelectOptions(
  primary: readonly OperatorSearchableSelectOption[],
  secondary: readonly OperatorSearchableSelectOption[]
): OperatorSearchableSelectOption[] {
  const seen = new Set<string>();
  const merged: OperatorSearchableSelectOption[] = [];
  for (const option of [...primary, ...secondary]) {
    if (seen.has(option.value)) {
      continue;
    }
    seen.add(option.value);
    merged.push(option);
  }
  return merged;
}

export type OperatorTourSelectListResponse = {
  readonly items: readonly OperatorTourSelectItem[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
};

export function parseOperatorTourListResponse(raw: unknown): OperatorTourSelectListResponse | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    return null;
  }
  const items = record.items
    .map((entry) => {
      if (entry === null || typeof entry !== "object") {
        return null;
      }
      const row = entry as Record<string, unknown>;
      const id = String(row.id ?? "").trim();
      const title = String(row.title ?? "").trim();
      if (id.length === 0 || title.length === 0) {
        return null;
      }
      return {
        id,
        title,
        departureAt:
          row.departureAt === null || row.departureAt === undefined
            ? null
            : String(row.departureAt),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  return {
    items,
    total: Number(record.total ?? items.length),
    page: Number(record.page ?? 1),
    limit: Number(record.limit ?? OPERATOR_TOUR_SELECT_DEFAULT_LIMIT),
  };
}
