/**
 * Booking dependency registry — apps/api composition layer (Phase B1.8).
 *
 * Thin wrapper over generated manifest bindings (Finance finance-dependency-registry mirror).
 * No workspace package imports — adapters live only in `*.generated.ts`.
 */

export {
  isBookingDependencyBindingRegistered,
  listBookingDependencyWorkspaceTypes,
  resolveBookingWorkspaceDependencies,
  WORKSPACE_BOOKING_DEPENDENCY_BINDINGS,
} from "./workspace-booking-dependency-bindings.generated";
