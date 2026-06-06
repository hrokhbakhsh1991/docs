import { Client } from "minio";

import {
  assertDenaliTourPhotoKeyTenantScope,
  buildDenaliTourPhotoObjectKey,
} from "./tour-photo-object-key";

export type MinioPhotoConfig = {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
};

export function readMinioPhotoConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): MinioPhotoConfig | null {
  const endpointRaw = env.MINIO_ENDPOINT?.trim();
  const accessKey = env.MINIO_ACCESS_KEY?.trim();
  const secretKey = env.MINIO_SECRET_KEY?.trim();
  const bucket = env.MINIO_BUCKET?.trim();
  if (!endpointRaw || !accessKey || !secretKey || !bucket) {
    return null;
  }

  const parsed = new URL(endpointRaw);
  const useSSL = parsed.protocol === "https:" || env.MINIO_USE_SSL?.trim() === "true";
  const port = parsed.port.length > 0 ? Number.parseInt(parsed.port, 10) : useSSL ? 443 : 9000;

  return {
    endPoint: parsed.hostname,
    port: Number.isFinite(port) ? port : 9000,
    useSSL,
    accessKey,
    secretKey,
    bucket,
  };
}

export function createMinioPhotoClient(config: MinioPhotoConfig): Client {
  return new Client({
    endPoint: config.endPoint,
    port: config.port,
    useSSL: config.useSSL,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });
}

export async function pingMinioPhotoStorage(config: MinioPhotoConfig): Promise<boolean> {
  const client = createMinioPhotoClient(config);
  try {
    return await client.bucketExists(config.bucket);
  } catch {
    return false;
  }
}

/** Idempotent — creates bucket when missing (local dev / CI seed). */
export async function ensureMinioPhotoBucket(config: MinioPhotoConfig): Promise<void> {
  const client = createMinioPhotoClient(config);
  const exists = await client.bucketExists(config.bucket);
  if (!exists) {
    await client.makeBucket(config.bucket);
  }
}

export async function putDenaliTourPhoto(input: {
  config: MinioPhotoConfig;
  tenantId: string;
  tourId: string;
  photoId: string;
  body: Buffer;
  contentType: string;
}): Promise<{ key: string }> {
  const key = buildDenaliTourPhotoObjectKey({
    tenantId: input.tenantId,
    tourId: input.tourId,
    photoId: input.photoId,
  });
  assertDenaliTourPhotoKeyTenantScope(key, input.tenantId);
  const client = createMinioPhotoClient(input.config);
  await client.putObject(input.config.bucket, key, input.body, input.body.length, {
    "Content-Type": input.contentType,
  });
  return { key };
}

export async function getDenaliTourPhotoSignedReadUrl(input: {
  config: MinioPhotoConfig;
  tenantId: string;
  key: string;
  expiresInSeconds?: number;
}): Promise<string> {
  assertDenaliTourPhotoKeyTenantScope(input.key, input.tenantId);
  const client = createMinioPhotoClient(input.config);
  return client.presignedGetObject(input.config.bucket, input.key, input.expiresInSeconds ?? 300);
}
