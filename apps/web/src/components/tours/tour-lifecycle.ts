import type { TourLifecycleStatus } from "@repo/types";

/**
 * Tour lifecycle as shown in forms and list filters (`draft` | `active` | `archived`).
 * Maps to API {@link TourLifecycleStatus}: DRAFT | OPEN | CLOSED (CANCELLED reads as archived).
 */
export type TourFormLifecycleStatus = "draft" | "active" | "archived";

/** API enum → form / filter value. */
export function apiLifecycleToFormStatus(status: TourLifecycleStatus): TourFormLifecycleStatus {
  switch (status) {
    case "OPEN":
      return "active";
    case "CLOSED":
    case "CANCELLED":
      return "archived";
    default:
      return "draft";
  }
}

/** Form / filter value → API enum (PATCH). `archived` → CLOSED per product mapping. */
export function formLifecycleToApi(status: TourFormLifecycleStatus): TourLifecycleStatus {
  switch (status) {
    case "active":
      return "OPEN";
    case "archived":
      return "CLOSED";
    default:
      return "DRAFT";
  }
}

/** Short label for badges and headings (distinct from internal value strings). */
export function lifecycleDisplayLabel(ui: TourFormLifecycleStatus): string {
  switch (ui) {
    case "active":
      return "Active";
    case "archived":
      return "Archived";
    default:
      return "Draft";
  }
}
