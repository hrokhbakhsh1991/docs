/**
 * Phase B — finance list identity projection (FINANCE-OPS-UX §5.0b).
 * Generic fields only; loaded from bookings under tenant RLS — not Denali tour schema.
 */
import { getBookingsRepository } from "../bookings/create-bookings-repository";

export type FinanceRegistrationContext = {
  readonly registrationId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly memberDisplayName: string;
};

export function filterRowsByRegistrationId<T extends { readonly registrationId: string }>(
  rows: readonly T[],
  registrationId: string | undefined
): readonly T[] {
  if (registrationId === undefined) {
    return rows;
  }
  return rows.filter((row) => row.registrationId === registrationId);
}

export async function loadFinanceRegistrationContextMap(
  tenantId: string,
  registrationIds: readonly string[]
): Promise<ReadonlyMap<string, FinanceRegistrationContext>> {
  const unique = [
    ...new Set(registrationIds.map((id) => id.trim()).filter((id) => id.length > 0)),
  ];
  if (unique.length === 0) {
    return new Map();
  }
  const bookings = await getBookingsRepository().getByIds(unique, tenantId);
  const map = new Map<string, FinanceRegistrationContext>();
  for (const booking of bookings) {
    map.set(booking.id, {
      registrationId: booking.id,
      tourId: booking.tourId,
      tourTitle: booking.tourTitle,
      memberDisplayName: booking.guestLabel,
    });
  }
  return map;
}

export function attachFinanceRegistrationContext<T extends { readonly registrationId: string }>(
  row: T,
  contexts: ReadonlyMap<string, FinanceRegistrationContext>
): T & { readonly registrationContext: FinanceRegistrationContext | null } {
  return {
    ...row,
    registrationContext: contexts.get(row.registrationId) ?? null,
  };
}
