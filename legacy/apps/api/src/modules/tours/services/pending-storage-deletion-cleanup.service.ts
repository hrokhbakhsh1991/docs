import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";

import { FILE_STORAGE_PORT, type FileStoragePort } from "../../../infra/storage/file-storage.port";
import { TenantDbContextService } from "../../../database/tenant-db-context.service";
import { TenantEntity } from "../../identity/entities/tenant.entity";
import { TourEntity } from "../entities/tour.entity";
import {
  PendingStorageDeletionEntity,
  PendingStorageDeletionStatus,
} from "../entities/pending-storage-deletion.entity";

/** Orphaned clone destinations older than this are removed from object storage. */
export const PENDING_STORAGE_DELETION_ORPHAN_TTL_MS = 60 * 60 * 1000;

const CLEANUP_BATCH_SIZE = 100;

/**
 * Extracts the tour id embedded in a clone destination object key
 * (`{tenantId}/tours/{tourId}/photos/...`).
 */
export function tourIdFromPendingStorageObjectKey(objectKey: string): string | null {
  const marker = "/tours/";
  const index = objectKey.indexOf(marker);
  if (index < 0) {
    return null;
  }
  const afterMarker = objectKey.slice(index + marker.length);
  const tourId = afterMarker.split("/")[0]?.trim();
  return tourId && tourId.length > 0 ? tourId : null;
}

@Injectable()
export class PendingStorageDeletionCleanupService {
  private readonly logger = new Logger(PendingStorageDeletionCleanupService.name);

  constructor(
    @Inject(FILE_STORAGE_PORT) private readonly fileStorage: FileStoragePort,
    @Inject(TenantDbContextService) private readonly tenantDbContext: TenantDbContextService,
    @InjectRepository(TenantEntity) private readonly tenantRepository: Repository<TenantEntity>,
  ) {}

  async cleanupOrphanedCloneObjects(): Promise<{ deletedObjects: number; deletedRows: number }> {
    const cutoff = new Date(Date.now() - PENDING_STORAGE_DELETION_ORPHAN_TTL_MS);
    const tenants = await this.tenantRepository.find({
      select: { id: true },
      where: { deletedAt: IsNull() },
    });

    let deletedObjects = 0;
    let deletedRows = 0;

    for (const { id: tenantId } of tenants) {
      const batch = await this.tenantDbContext.runInTenantScope(tenantId, async (manager) =>
        manager
          .createQueryBuilder(PendingStorageDeletionEntity, "psd")
          .leftJoin(
            TourEntity,
            "tour",
            `tour.tenant_id = psd.tenant_id AND tour.id = CAST(split_part(split_part(psd.object_key, '/tours/', 2), '/', 1) AS uuid)`,
          )
          .leftJoin(
            TourEntity,
            "dest_tour",
            "dest_tour.tenant_id = psd.tenant_id AND dest_tour.id = psd.destination_tour_id",
          )
          .where("psd.tenant_id = :tenantId", { tenantId: tenantId.trim().toLowerCase() })
          .andWhere("psd.status = :status", { status: PendingStorageDeletionStatus.PENDING })
          .andWhere("psd.created_at < :cutoff", { cutoff })
          .andWhere("psd.destination_tour_id IS NULL")
          .andWhere("tour.id IS NULL")
          .andWhere("dest_tour.id IS NULL")
          .orderBy("psd.created_at", "ASC")
          .take(CLEANUP_BATCH_SIZE)
          .getMany(),
      );

      for (const row of batch) {
        try {
          await this.fileStorage.deleteObject(row.objectKey);
          deletedObjects += 1;
        } catch (error: unknown) {
          this.logger.warn(
            `pending_storage_cleanup: deleteObject failed tenant=${row.tenantId} key=${row.objectKey}: ${String(error)}`,
          );
        }

        await this.tenantDbContext.runInTenantScope(tenantId, async (manager) => {
          await manager.delete(PendingStorageDeletionEntity, { id: row.id });
        });
        deletedRows += 1;
      }
    }

    return { deletedObjects, deletedRows };
  }
}
