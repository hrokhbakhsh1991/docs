import { MinioTenantObjectStorageAdapter } from "./minio-tenant-object-storage.adapter";
import type { TenantObjectStoragePort } from "./tenant-object-storage.port";

let singleton: TenantObjectStoragePort | null = null;

export function getTenantObjectStorage(): TenantObjectStoragePort {
  if (singleton === null) {
    singleton = new MinioTenantObjectStorageAdapter();
  }
  return singleton;
}

/** Tests only — inject memory / fake adapter. */
export function setTenantObjectStorageForTests(port: TenantObjectStoragePort | null): void {
  singleton = port;
}
