import type { TourFormValues } from "@/components/tours/tour-schema";

import type { CreateTourDto, TourDetailDto, UpdateTourDto } from "../../../lib/services/tours.service";

import type { TourLifecycleStatus } from "@repo/types";

import type { TourUiLifecycleStatus } from "./tour-display-types";

/** Maps UI select values (Draft / Published / Archived) to API lifecycle enum. */
function uiLifecycleToApi(ui: TourUiLifecycleStatus): TourLifecycleStatus {
  switch (ui) {
    case "Published":
      return "OPEN";
    case "Archived":
      return "CLOSED";
    default:
      return "DRAFT";
  }
}

/** Inverse for form defaults / badges. */
export function apiLifecycleToUi(status: TourLifecycleStatus): TourUiLifecycleStatus {
  switch (status) {
    case "OPEN":
      return "Published";
    case "CLOSED":
    case "CANCELLED":
      return "Archived";
    default:
      return "Draft";
  }
}


/**
 * Maps tour form values → {@link CreateTourDto} for `POST /api/v2/tours`.
 * Does not include dates (backend omits them). Archived UI maps to Draft on create (API allows Draft/Open only).
 */
export function createTourDtoFromTourFormValues(values: TourFormValues): CreateTourDto {
  const lifecycle_status: CreateTourDto["lifecycle_status"] =
    values.status === "active" ? "Open" : "Draft";
  return {
    title: values.title.trim(),
    ...(values.description?.trim() ? { description: values.description.trim() } : {}),
    capacity: values.totalCapacity,
    price: values.price,
    lifecycle_status,
  };
}

/** Maps edit form → {@link UpdateTourDto}; preserves embedded `cost_context.location` when API returned one. */
export function updateTourDtoFromTourFormValues(values: TourFormValues, existing: TourDetailDto): UpdateTourDto {
  const uiStatus: TourUiLifecycleStatus =
    values.status === "active" ? "Published" : values.status === "archived" ? "Archived" : "Draft";
  const lifecycle_status = uiLifecycleToApi(uiStatus);
  const existingLoc =
    existing.costContext &&
    typeof existing.costContext === "object" &&
    !Array.isArray(existing.costContext) &&
    typeof (existing.costContext as Record<string, unknown>).location === "string"
      ? String((existing.costContext as Record<string, unknown>).location)
      : undefined;
  return {
    title: values.title.trim(),
    description: values.description?.trim() ?? "",
    capacity: values.totalCapacity,
    price: values.price,
    lifecycle_status,
    ...(existingLoc ? { location: existingLoc } : {}),
  };
}

