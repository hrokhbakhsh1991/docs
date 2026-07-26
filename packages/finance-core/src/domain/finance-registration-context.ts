/**
 * Phase B / 1.6 — finance list identity helpers (pure).
 * Display loading goes through {@link RegistrationDisplayPort} — no Booking imports here.
 */

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

export function filterRowsByTourId<T extends { readonly registrationId: string }>(
  rows: readonly T[],
  tourId: string | undefined,
  contexts: ReadonlyMap<string, FinanceRegistrationContext>
): readonly T[] {
  if (tourId === undefined) {
    return rows;
  }
  return rows.filter((row) => contexts.get(row.registrationId)?.tourId === tourId);
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
