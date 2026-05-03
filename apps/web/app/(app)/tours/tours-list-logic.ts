import { extractTourPriceUsd } from "@/components/tours/formatters";
import type { TourDetailDto } from "@/lib/services/tours.service";

import { apiLifecycleToUi } from "./tour-ui-mappers";

export type TourUiStatus = ReturnType<typeof apiLifecycleToUi>;
export type TourStatusFilter = "all" | TourUiStatus;
export type TourSortColumn = "title" | "price";
export type TourSortDirection = "asc" | "desc";

export function filterToursByStatus(tours: TourDetailDto[], statusFilter: TourStatusFilter): TourDetailDto[] {
  return tours.filter((tour) => {
    if (statusFilter === "all") return true;
    return apiLifecycleToUi(tour.lifecycleStatus) === statusFilter;
  });
}

export function sortTours(
  tours: TourDetailDto[],
  options: { sortColumn: TourSortColumn; sortDir: TourSortDirection }
): TourDetailDto[] {
  const rows = [...tours];
  const factor = options.sortDir === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    if (options.sortColumn === "title") {
      return factor * a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    }
    const pa = extractTourPriceUsd(a.costContext);
    const pb = extractTourPriceUsd(b.costContext);
    return factor * (pa - pb);
  });
  return rows;
}
