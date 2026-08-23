/** Coerce a finite numeric capacity; non-finite → null. */
export function readFiniteCapacityNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
