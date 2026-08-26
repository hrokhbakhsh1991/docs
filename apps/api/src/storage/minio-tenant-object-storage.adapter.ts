import { resolveMinioPhotoPresignConfig } from "@app-tour/workspace-denali";

import {
  createTenantBrandLogoMinioClient,
  ensureTenantBrandLogoBucket,
  readTenantBrandLogoMinioConfigFromEnv,
} from "../tenant/workspace-branding-photo-storage";
import { assertTenantOwnsObjectKey } from "./assert-tenant-object-key-scope";
import type { TenantObjectRef, TenantObjectStoragePort } from "./tenant-object-storage.port";

const DEFAULT_SIGNED_READ_TTL_SECONDS = 300;

/**
 * Single MinIO adapter wrapping the existing shared branding-photo client.
 * Does not invent a second bucket stack.
 */
export class MinioTenantObjectStorageAdapter implements TenantObjectStoragePort {
  async put(
    input: TenantObjectRef & {
      readonly body: Buffer;
      readonly contentType: string;
    }
  ): Promise<void> {
    assertTenantOwnsObjectKey(input.storageKey, input.tenantId);
    const config = readTenantBrandLogoMinioConfigFromEnv();
    if (config === null) {
      throw new Error("MINIO_NOT_CONFIGURED");
    }
    await ensureTenantBrandLogoBucket(config);
    const client = createTenantBrandLogoMinioClient(config);
    const contentType =
      input.contentType.trim().toLowerCase().split(";")[0]?.trim() ?? "application/octet-stream";
    await client.putObject(config.bucket, input.storageKey, input.body, input.body.length, {
      "Content-Type": contentType,
    });
  }

  async getSignedReadUrl(
    input: TenantObjectRef & {
      readonly ttlSeconds?: number;
    }
  ): Promise<string> {
    assertTenantOwnsObjectKey(input.storageKey, input.tenantId);
    const config = readTenantBrandLogoMinioConfigFromEnv();
    if (config === null) {
      throw new Error("MINIO_NOT_CONFIGURED");
    }
    const presignConfig = resolveMinioPhotoPresignConfig(config);
    const client = createTenantBrandLogoMinioClient(presignConfig);
    return client.presignedGetObject(
      presignConfig.bucket,
      input.storageKey,
      input.ttlSeconds ?? DEFAULT_SIGNED_READ_TTL_SECONDS
    );
  }

  async remove(input: TenantObjectRef): Promise<void> {
    assertTenantOwnsObjectKey(input.storageKey, input.tenantId);
    const config = readTenantBrandLogoMinioConfigFromEnv();
    if (config === null) {
      throw new Error("MINIO_NOT_CONFIGURED");
    }
    const client = createTenantBrandLogoMinioClient(config);
    await client.removeObject(config.bucket, input.storageKey);
  }
}
