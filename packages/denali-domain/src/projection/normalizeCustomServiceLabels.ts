/** Trims and drops empty custom service labels for API wire payloads. */
export function normalizeCustomServiceLabels(
  labels: readonly string[] | undefined,
): string[] | undefined {
  if (!labels?.length) {
    return undefined;
  }
  const normalized = labels.map((label) => label.trim()).filter((label) => label.length > 0);
  return normalized.length > 0 ? normalized : undefined;
}
