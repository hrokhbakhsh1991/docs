/**
 * True when Layer A canonical template data has no defined top-level fields.
 * Matches {@link tryHydrateCanonicalTemplate} content gate and instantiate guard.
 */
export function isDenaliCanonicalTemplateDataEmpty(value: unknown): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return true;
  }
  return !(Object.keys(value) as string[]).some(
    (key) => (value as Record<string, unknown>)[key] !== undefined,
  );
}
