/**
 * Joins non-empty meta fragments for the Denali flat-edit page header
 * (departure · price · seats).
 */
export function buildDenaliFlatEditMetaLine(
  parts: readonly (string | null | undefined)[]
): string | null {
  const line = parts.filter((part) => part != null && part.length > 0).join(" · ");
  return line.length > 0 ? line : null;
}
