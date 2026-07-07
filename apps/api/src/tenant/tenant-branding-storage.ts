import {
  assertTenantBrandLogoBytesMatchContentType,
  assertTenantBrandLogoKeyTenantScope,
  buildTenantBrandLogoObjectKey,
  isTenantBrandLogoContentType,
  TENANT_BRAND_LOGO_MAX_BYTES,
} from "@app-tour/workspace-sdk";

import {
  createTenantBrandLogoMinioClient,
  ensureTenantBrandLogoBucket,
  getTenantBrandLogoSignedReadUrl,
  readTenantBrandLogoMinioConfigFromEnv,
} from "./workspace-branding-photo-storage";

export { readTenantBrandLogoMinioConfigFromEnv };

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

  const config = readTenantBrandLogoMinioConfigFromEnv();
  if (config === null) {
    throw new Error("MINIO_NOT_CONFIGURED");
  }

  const storageKey = buildTenantBrandLogoObjectKey(input.tenantId);
  assertTenantBrandLogoKeyTenantScope(storageKey, input.tenantId);
  await ensureTenantBrandLogoBucket(config);
  const client = createTenantBrandLogoMinioClient(config);
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
  const config = readTenantBrandLogoMinioConfigFromEnv();
  if (config === null) {
    throw new Error("MINIO_NOT_CONFIGURED");
  }
  const client = createTenantBrandLogoMinioClient(config);
  await client.removeObject(config.bucket, input.storageKey);
}

export { getTenantBrandLogoSignedReadUrl };
