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
};

/**
 * Tenant-scoped tour persistence port (P0-02).
 * All reads must take `tenantId`; cross-tenant access returns null / empty — never foreign rows.
 */
export interface TourStorageRepository {
  getById(id: string, tenantId: string): Promise<Tour | null>;

  save(tour: Tour): Promise<void>;

  listByTenant(tenantId: string): Promise<Tour[]>;
}

/**
 * Policy-layer helper: resolve a row by id only so CASL can detect cross-tenant reads.
 * Implementations must not use this for handler responses without a tenant check.
 */
export interface TourIdResolver {
  resolveById(id: string): Promise<Tour | null>;
}
