/**
 * Phase 3.2+ — storage surfaces allowed on the canonical write path (STORAGE_DRIVER).
 */
export const PHASE_32_CANONICAL_STORAGE = ["in_memory.tour_records", "prisma.tours"] as const;

export type Phase32CanonicalStorage = (typeof PHASE_32_CANONICAL_STORAGE)[number];

export function isPhase32CanonicalStorage(surface: string): surface is Phase32CanonicalStorage {
  return (PHASE_32_CANONICAL_STORAGE as readonly string[]).includes(surface);
}
