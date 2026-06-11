import {
  createMinioPhotoClient,
  ensureMinioPhotoBucket,
  getDenaliTourPhotoSignedReadUrl,
  readMinioPhotoConfigFromEnv,
} from "@app-tour/workspace-denali";
import {
  assertTenantBrandLogoBytesMatchContentType,
  assertTenantBrandLogoKeyTenantScope,
  buildTenantBrandLogoObjectKey,
  isTenantBrandLogoContentType,
  TENANT_BRAND_LOGO_MAX_BYTES,
} from "@app-tour/workspace-sdk";

export { readMinioPhotoConfigFromEnv as readTenantBrandLogoMinioConfigFromEnv };

export function assertTenantBrandLogoUploadContentType(contentType: string): void {
  const normalized = contentType.trim().toLowerCase();
  if (!isTenantBrandLogoContentType(normalized)) {
    throw new Error("TENANT_BRAND_LOGO_CONTENT_TYPE_INVALID");
  }
}

export async function putTenantBrandLogo(input: {
  readonly tenantId: string;
  readonly body: Buffer;
  readonly contentType: string;
}): Promise<{ readonly storageKey: string }> {
  assertTenantBrandLogoUploadContentType(input.contentType);
  if (input.body.length === 0) {
    throw new Error("TENANT_BRAND_LOGO_EMPTY");
  }
  if (input.body.length > TENANT_BRAND_LOGO_MAX_BYTES) {
    throw new Error("TENANT_BRAND_LOGO_TOO_LARGE");
  }
  assertTenantBrandLogoBytesMatchContentType(input.body, input.contentType);

  const config = readMinioPhotoConfigFromEnv();
  if (config === null) {
    throw new Error("MINIO_NOT_CONFIGURED");
  }

  const storageKey = buildTenantBrandLogoObjectKey(input.tenantId);
  assertTenantBrandLogoKeyTenantScope(storageKey, input.tenantId);
  await ensureMinioPhotoBucket(config);
  const client = createMinioPhotoClient(config);
  await client.putObject(config.bucket, storageKey, input.body, input.body.length, {
    "Content-Type": input.contentType.trim().toLowerCase(),
  });
  return { storageKey };
}

export async function deleteTenantBrandLogoObject(input: {
  readonly tenantId: string;
  readonly storageKey: string;
}): Promise<void> {
  assertTenantBrandLogoKeyTenantScope(input.storageKey, input.tenantId);
  const config = readMinioPhotoConfigFromEnv();
  if (config === null) {
    throw new Error("MINIO_NOT_CONFIGURED");
  }
  const client = createMinioPhotoClient(config);
  await client.removeObject(config.bucket, input.storageKey);
}

export async function getTenantBrandLogoSignedReadUrl(input: {
  readonly tenantId: string;
  readonly storageKey: string;
  readonly expiresInSeconds?: number;
}): Promise<string> {
  assertTenantBrandLogoKeyTenantScope(input.storageKey, input.tenantId);
  const config = readMinioPhotoConfigFromEnv();
  if (config === null) {
    throw new Error("MINIO_NOT_CONFIGURED");
  }
  return getDenaliTourPhotoSignedReadUrl({
    config,
    tenantId: input.tenantId,
    key: input.storageKey,
    expiresInSeconds: input.expiresInSeconds ?? 300,
  });
}
