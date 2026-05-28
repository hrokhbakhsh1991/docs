/** Tour departure / catalog lifecycle (Postgres `tour_lifecycle_status_enum`). */
export enum TourLifecycleStatus {
  DRAFT = "DRAFT",
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  CANCELLED = "CANCELLED"
}
