import type { RegionalTourListScope } from "../../../../common/rbac/capability-grant-context-from-request";
import type { EntityManager } from "typeorm";
import type { DeepPartial } from "typeorm";
import type { ListToursQueryDto } from "../../dto/list-tours-query.dto";
import type { TourResponseDto } from "../../dto/tour-response.dto";
import type { TourWriteRecord } from "../tour-write-record.types";

export const TOURS_CATALOG_REPOSITORY_PORT = Symbol("TOURS_CATALOG_REPOSITORY_PORT");

export type ToursCatalogListPageInput = {
  tenantId: string;
  query: ListToursQueryDto;
  regionalScope: RegionalTourListScope;
  page: number;
  limit: number;
  useKeyset: boolean;
  cursorAt: Date | null;
  cursorId: string | null;
};

export type ToursCatalogListPageResult = {
  items: TourResponseDto[];
  total: number;
  page: number;
  limit: number;
};

/**
 * Persistence port for tenant-scoped tour catalog reads.
 * Application services depend on this interface; TypeORM lives only in adapters.
 *
 * **TypeORM policy (Phase 4):** `import type` from `typeorm` is permitted in port interfaces — see MAP §61.
 */
export interface ToursCatalogRepositoryPort {
  listPage(input: ToursCatalogListPageInput): Promise<ToursCatalogListPageResult>;

  /**
   * Loads a tour with response relations for the tenant.
   * @throws {NotFoundException} when the row is missing (tenant-scoped 404 envelope).
   */
  findByIdOrThrow(tenantId: string, tourId: string): Promise<TourWriteRecord>;
}

export const TOURS_WRITE_REPOSITORY_PORT = Symbol("TOURS_WRITE_REPOSITORY_PORT");

/**
 * Persistence port for tour catalog writes (create/update + product/departure sync).
 * Application services depend on this interface; TypeORM lives only in adapters.
 *
 * **TypeORM policy (Phase 4):** `import type` from `typeorm` is permitted in port interfaces — see MAP §61.
 */
export interface ToursWriteRepositoryPort {
  getIdempotentManager(): EntityManager | null;

  getDefaultManager(): EntityManager;

  runInTransaction<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T>;

  createTourEntity(manager: EntityManager, data: DeepPartial<TourWriteRecord>): TourWriteRecord;

  /** Save new tour, reload with response relations, sync product/departure rows. */
  createTour(manager: EntityManager, tour: TourWriteRecord, tenantId: string): Promise<TourWriteRecord>;

  loadTourForUpdateLocking(
    manager: EntityManager,
    tourId: string,
    tenantId: string
  ): Promise<TourWriteRecord | null>;

  /** Save tour patch, reload with response relations, sync product/departure rows. */
  updateTour(manager: EntityManager, tour: TourWriteRecord, tenantId: string): Promise<TourWriteRecord>;

  syncProductDepartureForTour(manager: EntityManager, tour: TourWriteRecord): Promise<void>;
}
