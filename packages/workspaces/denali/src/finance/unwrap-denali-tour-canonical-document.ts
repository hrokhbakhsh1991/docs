/**
 * Explicit Denali tour-canonical envelope boundary (PR15-E).
 *
 * Live Prisma / wizard storage shape:
 *   { data: { pricing, … }, roots, schemaVersion }
 *
 * Legacy / fixture shape:
 *   { pricing: { … }, … }  (document root is the pricing host)
 *
 * Domain resolvers must receive the **document root** (where `pricing.*` lives),
 * never invent amounts, and never deep-search arbitrary keys.
 */

/**
 * Unwrap tour storage / wizard envelope to the canonical **document** object
 * that hosts `pricing.*` (and related commercial fields).
 *
 * @returns document root, or `null` when input is malformed / non-object
 */
export function unwrapDenaliTourCanonicalDocument(
  tourCanonical: unknown
): Record<string, unknown> | null {
  if (tourCanonical === null || typeof tourCanonical !== "object" || Array.isArray(tourCanonical)) {
    return null;
  }
  const root = tourCanonical as Record<string, unknown>;

  // Wizard / Prisma envelope: prefer nested `data` when it is a plain object.
  if ("data" in root) {
    const nested = root.data;
    if (nested === null || nested === undefined) {
      return null;
    }
    if (typeof nested !== "object" || Array.isArray(nested)) {
      return null;
    }
    return nested as Record<string, unknown>;
  }

  // Flat legacy document (fixtures / older seeds).
  return root;
}
