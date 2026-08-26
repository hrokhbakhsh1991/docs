import {
  assertOperatorAvatarBytesMatchContentType,
  assertOperatorAvatarKeyScope,
  buildOperatorAvatarObjectKey,
  isOperatorAvatarContentType,
  OPERATOR_AVATAR_MAX_BYTES,
} from "@app-tour/workspace-sdk";

import { resolveMinioPhotoPresignConfig } from "@app-tour/workspace-denali";

import {
  createTenantBrandLogoMinioClient,
  ensureTenantBrandLogoBucket,
  readTenantBrandLogoMinioConfigFromEnv,
} from "../tenant/workspace-branding-photo-storage";

export { readTenantBrandLogoMinioConfigFromEnv as readOperatorAvatarMinioConfigFromEnv };

const OPERATOR_AVATAR_READ_URL_TTL_SECONDS = 300;

type MinioPhotoConfig = NonNullable<ReturnType<typeof readTenantBrandLogoMinioConfigFromEnv>>;
type MinioPhotoClient = ReturnType<typeof createTenantBrandLogoMinioClient>;

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
  const config = readTenantBrandLogoMinioConfigFromEnv();
  if (config === null) {
    throw new Error("MINIO_NOT_CONFIGURED");
  }
  const presignConfig = resolveMinioPhotoPresignConfig(config);
  const client = createTenantBrandLogoMinioClient(presignConfig);
  return client.presignedGetObject(
    presignConfig.bucket,
    input.storageKey,
    input.expiresInSeconds ?? OPERATOR_AVATAR_READ_URL_TTL_SECONDS
  );
}

export type OperatorAvatarMembershipRef = {
  readonly tenantId: string;
  readonly userId: string;
  readonly storageKey: string | undefined;
};

function hasNonEmptyAvatarStorageKey(input: OperatorAvatarMembershipRef): boolean {
  return (input.storageKey?.trim() ?? "").length > 0;
}

async function presignOperatorAvatarReadUrl(
  config: MinioPhotoConfig,
  _client: MinioPhotoClient,
  input: OperatorAvatarMembershipRef,
  expiresInSeconds: number
): Promise<string | null> {
  const normalized = input.storageKey?.trim() ?? "";
  if (normalized.length === 0) {
    return null;
  }
  try {
    assertOperatorAvatarKeyScope(normalized, input.tenantId, input.userId);
    const presignConfig = resolveMinioPhotoPresignConfig(config);
    const presignClient = createTenantBrandLogoMinioClient(presignConfig);
    return await presignClient.presignedGetObject(
      presignConfig.bucket,
      normalized,
      expiresInSeconds
    );
  } catch {
    return null;
  }
}

async function presignOperatorAvatarReadUrls(
  config: MinioPhotoConfig,
  client: MinioPhotoClient,
  inputs: readonly OperatorAvatarMembershipRef[],
  expiresInSeconds: number
): Promise<readonly (string | null)[]> {
  return Promise.all(
    inputs.map((input) => presignOperatorAvatarReadUrl(config, client, input, expiresInSeconds))
  );
}

/**
 * Batch presign for directory list — one env config read + one MinIO client per page (read path; no bucketExists).
 */
export async function resolveOperatorAvatarUrlsForMemberships(
  inputs: readonly OperatorAvatarMembershipRef[]
): Promise<readonly (string | null)[]> {
  if (inputs.length === 0) {
    return [];
  }
  if (!inputs.some(hasNonEmptyAvatarStorageKey)) {
    return inputs.map(() => null);
  }

  const config = readTenantBrandLogoMinioConfigFromEnv();
  if (config === null) {
    return inputs.map(() => null);
  }

  const client = createTenantBrandLogoMinioClient(config);
  return presignOperatorAvatarReadUrls(
    config,
    client,
    inputs,
    OPERATOR_AVATAR_READ_URL_TTL_SECONDS
  );
}

export async function resolveOperatorAvatarUrlForMembership(
  tenantId: string,
  userId: string,
  storageKey: string | undefined
): Promise<string | null> {
  const [url] = await resolveOperatorAvatarUrlsForMemberships([
    { tenantId, userId, storageKey },
  ]);
  return url ?? null;
}
