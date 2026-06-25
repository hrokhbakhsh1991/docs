import {
  assertOperatorAvatarBytesMatchContentType,
  assertOperatorAvatarKeyScope,
  buildOperatorAvatarObjectKey,
  isOperatorAvatarContentType,
  OPERATOR_AVATAR_MAX_BYTES,
} from "@app-tour/workspace-sdk";

import {
  createTenantBrandLogoMinioClient,
  ensureTenantBrandLogoBucket,
  getTenantBrandLogoSignedReadUrl,
  readTenantBrandLogoMinioConfigFromEnv,
} from "../tenant/workspace-branding-photo-storage";

export { readTenantBrandLogoMinioConfigFromEnv as readOperatorAvatarMinioConfigFromEnv };

export function assertOperatorAvatarUploadContentType(contentType: string): void {
  const normalized = contentType.trim().toLowerCase();
  if (!isOperatorAvatarContentType(normalized)) {
    throw new Error("OPERATOR_AVATAR_CONTENT_TYPE_INVALID");
  }
}

export async function putOperatorAvatar(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly body: Buffer;
  readonly contentType: string;
}): Promise<{ readonly storageKey: string }> {
  assertOperatorAvatarUploadContentType(input.contentType);
  if (input.body.length === 0) {
    throw new Error("OPERATOR_AVATAR_EMPTY");
  }
  if (input.body.length > OPERATOR_AVATAR_MAX_BYTES) {
    throw new Error("OPERATOR_AVATAR_TOO_LARGE");
  }
  assertOperatorAvatarBytesMatchContentType(input.body, input.contentType);

  const config = readTenantBrandLogoMinioConfigFromEnv();
  if (config === null) {
    throw new Error("MINIO_NOT_CONFIGURED");
  }

  const storageKey = buildOperatorAvatarObjectKey(input.tenantId, input.userId);
  assertOperatorAvatarKeyScope(storageKey, input.tenantId, input.userId);
  await ensureTenantBrandLogoBucket(config);
  const client = createTenantBrandLogoMinioClient(config);
  await client.putObject(config.bucket, storageKey, input.body, input.body.length, {
    "Content-Type": input.contentType.trim().toLowerCase(),
  });
  return { storageKey };
}

export async function deleteOperatorAvatarObject(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly storageKey: string;
}): Promise<void> {
  assertOperatorAvatarKeyScope(input.storageKey, input.tenantId, input.userId);
  const config = readTenantBrandLogoMinioConfigFromEnv();
  if (config === null) {
    throw new Error("MINIO_NOT_CONFIGURED");
  }
  const client = createTenantBrandLogoMinioClient(config);
  await client.removeObject(config.bucket, input.storageKey);
}

export async function getOperatorAvatarSignedReadUrl(input: {
  readonly tenantId: string;
  readonly userId: string;
  readonly storageKey: string;
  readonly expiresInSeconds?: number;
}): Promise<string> {
  assertOperatorAvatarKeyScope(input.storageKey, input.tenantId, input.userId);
  return getTenantBrandLogoSignedReadUrl({
    tenantId: input.tenantId,
    storageKey: input.storageKey,
    expiresInSeconds: input.expiresInSeconds,
  });
}

export async function resolveOperatorAvatarUrlForMembership(
  tenantId: string,
  userId: string,
  storageKey: string | undefined
): Promise<string | null> {
  const normalized = storageKey?.trim() ?? "";
  if (normalized.length === 0) {
    return null;
  }
  try {
    return await getOperatorAvatarSignedReadUrl({
      tenantId,
      userId,
      storageKey: normalized,
    });
  } catch {
    return null;
  }
}
