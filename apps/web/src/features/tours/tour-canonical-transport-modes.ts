/**
 * I-06 — thin host adapter for tour canonical transport modes.
 * Single place for path knowledge (`details.tripDetails.transportModes` + fallbacks).
 * No import from workspace package internals — capability/translator stays elsewhere.
 *
 * @see docs/phase-9/appendices/TOURS-WORKSPACE-UX-HARDENING-PLAN.md (I-06)
 */

function readTransportModesValue(raw: unknown): readonly string[] {
  if (typeof raw === "string" && raw.trim().length > 0) {
    return [raw.trim()];
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
  );
}

function readNestedTransportModes(
  data: Record<string, unknown>,
  path: readonly string[]
): readonly string[] {
  let cursor: unknown = data;
  for (const segment of path) {
    if (typeof cursor !== "object" || cursor === null) {
      return [];
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  if (typeof cursor !== "object" || cursor === null) {
    return [];
  }
  return readTransportModesValue((cursor as Record<string, unknown>).transportModes);
}

/**
 * Extract offered transport modes from operator tour payload (`canonical.data`).
 * Paths (union): details.tripDetails · tripDetails · data.transportModes
 */
export function extractTransportModesFromTourPayload(payload: Record<string, unknown>): string[] {
  const canonical = payload.canonical;
  if (typeof canonical !== "object" || canonical === null) {
    return [];
  }
  const data = (canonical as Record<string, unknown>).data;
  if (typeof data !== "object" || data === null) {
    return [];
  }
  const record = data as Record<string, unknown>;
  const modes = new Set<string>();
  for (const mode of readNestedTransportModes(record, ["details", "tripDetails"])) {
    modes.add(mode.trim());
  }
  for (const mode of readNestedTransportModes(record, ["tripDetails"])) {
    modes.add(mode.trim());
  }
  for (const mode of readTransportModesValue(record.transportModes)) {
    modes.add(mode.trim());
  }
  return [...modes].sort((a, b) => a.localeCompare(b));
}
