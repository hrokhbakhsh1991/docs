import { Module } from "@nestjs/common";
import { FILE_STORAGE_PORT } from "./file-storage.port";
import { MinioStorageAdapter } from "./minio-storage.adapter";
import { StorageHealthService } from "./storage-health.service";

@Module({
  providers: [
    MinioStorageAdapter,
    StorageHealthService,
    {
      provide: FILE_STORAGE_PORT,
      useExisting: MinioStorageAdapter
    }
  ],
  exports: [FILE_STORAGE_PORT, StorageHealthService]
})
export class StorageModule {}
