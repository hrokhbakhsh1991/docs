import { resolveBookingsCommandCenterBodyState } from "@/features/bookings/bookings-command-center-logic";
import type { BookingsListView } from "@/features/bookings/bookings-command-center-types";

export function resolveBookingsPageBodyState(input: {
  readonly canManageOps: boolean;
  readonly view: BookingsListView;
  readonly loading: boolean;
  readonly error: string | null;
  readonly itemsLength: number;
}) {
  return resolveBookingsCommandCenterBodyState(input);
}
