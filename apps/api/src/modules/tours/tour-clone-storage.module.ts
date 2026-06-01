import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DatabaseModule } from "../../database/database.module";
import { StorageModule } from "../../infra/storage/storage.module";
import { TenantEntity } from "../identity/entities/tenant.entity";
import { PendingStorageDeletionEntity } from "./entities/pending-storage-deletion.entity";
import { TourEntity } from "./entities/tour.entity";
import { PendingStorageDeletionCleanupService } from "./services/pending-storage-deletion-cleanup.service";
import { TourClonePendingStorageService } from "./services/tour-clone-pending-storage.service";

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    TypeOrmModule.forFeature([PendingStorageDeletionEntity, TenantEntity, TourEntity]),
  ],
  providers: [TourClonePendingStorageService, PendingStorageDeletionCleanupService],
  exports: [TourClonePendingStorageService, PendingStorageDeletionCleanupService],
})
export class TourCloneStorageModule {}
