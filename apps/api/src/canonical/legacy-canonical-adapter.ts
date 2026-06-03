import type { TourRecord } from "../db/tour-record";

/**
 * Phase 3.4 — legacy tables are not a write target. Reads may be bridged here in later phases;
 * Phase 3 scaffold keeps legacy mirror empty and rejects writes.
 */
export class LegacyCanonicalAdapter {
  private readonly mirror: TourRecord[] = [];

  /** Read-only view of legacy mirror (Phase 3: always empty — no dual-write). */
  listMirroredTours(): readonly TourRecord[] {
    return this.mirror;
  }

  /**
   * Redirect legacy persistence attempts through this adapter — throws to prevent dual-write.
   */
  writeLegacyTour(_record: TourRecord): never {
    throw new Error("DUAL_WRITE_FORBIDDEN: legacy tour tables are not writable in Phase 3.4");
  }
}
