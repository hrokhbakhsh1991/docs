import type { CanonicalDocument } from "@app-tour/workspace-sdk";

/**
 * Canonical tour aggregate persisted by apps/api (Phase 3.2+).
 * Single write shape — maps 1:1 to {@link TourRecord} in the db policy layer.
 */
export type Tour = {
  readonly id: string;
  readonly tenantId: string;
  readonly canonical: CanonicalDocument;
  readonly createdAt: string;
  readonly rowVersion: number;
};

/**
 * Tenant-scoped tour persistence port (P0-02).
 * All reads must take `tenantId`; cross-tenant access returns null / empty — never foreign rows.
 */
export type TourListByTenantPageInput = {
  readonly tenantId: string;
  readonly limit: number;
  readonly cursor?: string;
};

export type TourListByTenantPageOutput = {
  readonly items: readonly Tour[];
  readonly nextCursor: string | null;
};

export interface TourStorageRepository {
  getById(id: string, tenantId: string): Promise<Tour | null>;

  save(tour: Tour): Promise<void>;

  listByTenant(tenantId: string): Promise<Tour[]>;

  listByTenantPage(input: TourListByTenantPageInput): Promise<TourListByTenantPageOutput>;

  /**
   * Updates canonical when `expectedRowVersion` matches — increments row_version.
   * @throws {import("../tours/tour-version-conflict").TourVersionConflictError} on stale version
   */
  updateIfRowVersion(input: {
    readonly tenantId: string;
    readonly id: string;
    readonly canonical: CanonicalDocument;
    readonly expectedRowVersion: number;
  }): Promise<Tour>;
}
