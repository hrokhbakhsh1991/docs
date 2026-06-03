import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import type { ApiAbility } from "../casl/api-ability";
import { accessibleByTourWhere } from "../casl/api-ability";
import { ScopedTourRepository } from "../db/scoped-tour.repository";
import type { TourRecord } from "../db/tour-record";
import type { TourStorageRepository } from "../db/tour.repository";
import { validateCanonicalLegacySync } from "./canonical-sync-validator";
import { LegacyCanonicalAdapter } from "./legacy-canonical-adapter";
import { PHASE_32_CANONICAL_STORAGE } from "./canonical-storage";

export type CanonicalTourWriteInput = {
  readonly ability: ApiAbility;
  readonly tenantId: string;
  readonly canonical: CanonicalDocument;
};

/**
 * Canonical Service — single write path to {@link PHASE_32_CANONICAL_STORAGE}.
 * Legacy access is redirected through {@link LegacyCanonicalAdapter} (read-only / no dual-write).
 */
export class CanonicalTourService {
  constructor(
    private readonly canonicalStore: TourStorageRepository,
    private readonly legacyAdapter: LegacyCanonicalAdapter,
  ) {}

  async writeTour(input: CanonicalTourWriteInput): Promise<TourRecord> {
    accessibleByTourWhere(input.ability, "create");

    const scopedRepo = new ScopedTourRepository(this.canonicalStore, input.ability);
    const record = await scopedRepo.create({
      tenantId: input.tenantId,
      canonical: input.canonical,
    });

    const sync = validateCanonicalLegacySync({
      canonicalRecords: [record],
      legacyRecords: this.legacyAdapter.listMirroredTours(),
    });
    if (!sync.ok) {
      throw new Error(`CANONICAL_SYNC_VALIDATION_FAILED: ${sync.violations.join(", ")}`);
    }

    return record;
  }

  async readTourById(ability: ApiAbility, tourId: string): Promise<TourRecord | null> {
    accessibleByTourWhere(ability, "read");
    const scopedRepo = new ScopedTourRepository(this.canonicalStore, ability);
    return scopedRepo.findFirst({ id: tourId });
  }

}
