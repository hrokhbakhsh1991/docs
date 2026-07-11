/** Statuses excluded from guest duplicate-finder queries (active registration check). */
export const INACTIVE_DUPLICATE_STATUSES = ["cancelled", "rejected"] as const;

export type ActiveDuplicateLookupInput = {
  readonly tenantId: string;
  readonly tourId: string;
};

export function isActiveDuplicateBookingStatus(status: string): boolean {
  return !INACTIVE_DUPLICATE_STATUSES.includes(
    status as (typeof INACTIVE_DUPLICATE_STATUSES)[number]
  );
}

export function readRegistrationIntakeNationalId(
  intake: Readonly<Record<string, unknown>> | undefined
): string | null {
  if (intake === undefined) {
    return null;
  }
  const nationalId = intake.nationalId;
  if (typeof nationalId !== "string") {
    return null;
  }
  const trimmed = nationalId.trim();
  return trimmed.length > 0 ? trimmed : null;
}
