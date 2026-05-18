import { Inject, Injectable } from "@nestjs/common";
import { MinioStorageAdapter } from "./minio-storage.adapter";

export type StorageHealthSnapshot = {
  status: "ok" | "unavailable" | "skipped";
  bucket?: string;
  reason?: string;
};

@Injectable()
export class StorageHealthService {
  constructor(
    @Inject(MinioStorageAdapter) private readonly minioStorage: MinioStorageAdapter
  ) {}

  async check(): Promise<StorageHealthSnapshot> {
    if (process.env.NODE_ENV === "test") {
      return { status: "skipped", reason: "storage_health_disabled_in_test" };
    }

    try {
      const reachable = await this.minioStorage.ping();
      if (!reachable.ok) {
        return {
          status: "unavailable",
          bucket: reachable.bucket,
          reason: reachable.reason ?? "bucket_unreachable"
        };
      }
      return { status: "ok", bucket: reachable.bucket };
    } catch {
      return { status: "unavailable", reason: "storage_ping_failed" };
    }
  }
}
