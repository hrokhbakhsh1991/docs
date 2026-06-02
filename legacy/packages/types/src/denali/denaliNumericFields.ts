/**
 * Denali numeric field helpers — no silent coercion of null/undefined/zero.
 * Invalid values are passed through for Zod / rule-engine rejection.
 */

/** Maps form capacityMax without substituting 0 for missing values. */
export function denaliFormCapacityMaxToCanonical(
  value: number | null | undefined,
): number | undefined {
  if (value == null || Number.isNaN(value)) {
    return undefined;
  }
  return value;
}

/** Maps form dong / price amounts without substituting defaults. */
export function denaliFormAmountToCanonical(
  value: number | null | undefined,
): number | undefined {
  if (value == null || Number.isNaN(value)) {
    return undefined;
  }
  return value;
}

export function isDenaliPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
