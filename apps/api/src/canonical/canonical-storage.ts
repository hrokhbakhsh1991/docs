/**
 * Phase 3.2 — storage surfaces touched by @apps/api (canonical write path only).
 * No Postgres tables, legacy entities, or dual-write targets in this scaffold.
 */
export const PHASE_32_CANONICAL_STORAGE = ["in_memory.tour_records"] as const;

export type Phase32CanonicalStorage = (typeof PHASE_32_CANONICAL_STORAGE)[number];

export function isPhase32CanonicalStorage(surface: string): surface is Phase32CanonicalStorage {
  return (PHASE_32_CANONICAL_STORAGE as readonly string[]).includes(surface);
}
