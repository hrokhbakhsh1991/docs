import { Inject, Injectable } from "@nestjs/common";

import { LoggerService } from "../../../common/logger/logger.service";
import type { FileStoragePort } from "../../../infra/storage/file-storage.port";
import { TenantDbContextService } from "../../../database/tenant-db-context.service";
import {
  PendingStorageDeletionEntity,
  PendingStorageDeletionStatus,
} from "../entities/pending-storage-deletion.entity";
import type { TourPhotoCloneCopyPlan } from "../utils/tours-clone-photo-copy.util";

@Injectable()
export class TourClonePendingStorageService {
  constructor(
    @Inject(TenantDbContextService)
    private readonly tenantDbContext: TenantDbContextService,
    @Inject(LoggerService)
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Registers each destination key, then copies — each registration commits before copy
   * so a crash leaves durable cleanup metadata (no in-process `finally`).
   */
  async executeCloneCopiesWithSaga(input: {
    tenantId: string;
    cloneOperationId: string;
    fileStorage: FileStoragePort;
    plans: readonly TourPhotoCloneCopyPlan[];
  }): Promise<void> {
    for (const plan of input.plans) {
      await this.registerPendingDeletion(input.tenantId, input.cloneOperationId, plan.destKey);
      await input.fileStorage.copyObject({
        sourceKey: plan.sourceKey,
        destKey: plan.destKey,
      });
    }
  }

  async registerPendingDeletion(
    tenantId: string,
    cloneOperationId: string,
    objectKey: string,
  ): Promise<void> {
    const trimmedKey = objectKey.trim();
    if (!trimmedKey) {
      throw new Error("PENDING_STORAGE_DELETION_OBJECT_KEY_REQUIRED");
    }
    await this.tenantDbContext.runInTenantScope(tenantId, async (manager) => {
      const row = manager.create(PendingStorageDeletionEntity, {
        tenantId: tenantId.trim().toLowerCase(),
        objectKey: trimmedKey,
        cloneOperationId,
        status: PendingStorageDeletionStatus.PENDING,
      });
      await manager.save(row);
    });
  }

  /**
   * Marks saga committed and removes log rows after clone completes.
   * When `destinationTourId` is absent (clone persist failed), deletes copied MinIO objects first
   * (orphan sweeper) when `fileStorage` is provided — not a distributed transaction with createTour.
   */
  async releaseCloneOperation(
    tenantId: string,
    cloneOperationId: string,
    options?: { destinationTourId?: string; fileStorage?: FileStoragePort },
  ): Promise<void> {
    const trimmedTenant = tenantId.trim().toLowerCase();
    const destinationTourId = options?.destinationTourId?.trim() || null;
    const shouldSweepOrphans = destinationTourId == null && options?.fileStorage != null;

    await this.tenantDbContext.runInTenantScope(tenantId, async (manager) => {
      if (shouldSweepOrphans) {
        const pendingRows = await manager.find(PendingStorageDeletionEntity, {
          where: {
            cloneOperationId,
            tenantId: trimmedTenant,
            status: PendingStorageDeletionStatus.PENDING,
          },
        });
        for (const row of pendingRows) {
          try {
            await options.fileStorage!.deleteObject(row.objectKey);
          } catch (sweepError: unknown) {
            const message =
              sweepError instanceof Error ? sweepError.message : String(sweepError);
            this.loggerService.error("tour.clone.orphan_sweep_delete_failed", {
              event: "tour.clone.orphan_sweep_delete_failed",
              code: "TOUR_CLONE_ORPHAN_SWEEP_DELETE_FAILED",
              tenant_id: trimmedTenant,
              clone_operation_id: cloneOperationId,
              object_key: row.objectKey,
              error: message,
            });
          }
        }
      }

      await manager.update(
        PendingStorageDeletionEntity,
        { cloneOperationId, tenantId: trimmedTenant },
        {
          status: PendingStorageDeletionStatus.COMMITTED,
          ...(destinationTourId ? { destinationTourId } : {}),
        },
      );
      await manager.delete(PendingStorageDeletionEntity, {
        cloneOperationId,
        tenantId: trimmedTenant,
      });
    });
  }

  /** Test / ops helper — count pending rows for a clone operation. */
  async countPendingForOperation(tenantId: string, cloneOperationId: string): Promise<number> {
    return this.tenantDbContext.runInTenantScope(tenantId, async (manager) =>
      manager.count(PendingStorageDeletionEntity, {
        where: {
          cloneOperationId,
          tenantId: tenantId.trim().toLowerCase(),
          status: PendingStorageDeletionStatus.PENDING,
        },
      }),
    );
  }
}
