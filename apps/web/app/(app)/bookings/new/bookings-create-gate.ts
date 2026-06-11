import { resolveBookingCreatePageState } from "@/features/bookings/bookings-create-logic";

export function resolveBookingsCreatePageState(input: {
  readonly canManage: boolean;
  readonly loadingTours: boolean;
  readonly submitting: boolean;
  readonly error: string | null;
}) {
  return resolveBookingCreatePageState(input);
}
