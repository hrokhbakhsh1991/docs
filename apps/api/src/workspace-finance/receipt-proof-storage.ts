import { resolveMinioPhotoPresignConfig } from "@app-tour/workspace-denali";

import {
  createTenantBrandLogoMinioClient,
  ensureTenantBrandLogoBucket,
  readTenantBrandLogoMinioConfigFromEnv,
} from "../tenant/workspace-branding-photo-storage";

export const MEMBER_RECEIPT_PROOF_MAX_BYTES = 8 * 1024 * 1024;
const RECEIPT_PROOF_READ_URL_TTL_SECONDS = 300;

/** Dev memory-driver receipt bytes — not shared across processes. */
const memoryReceiptProofStore = new Map<string, Buffer>();

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export function sanitizeReceiptProofFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "receipt";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "receipt.bin";
}

export function buildMemberReceiptProofObjectKey(input: {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly fileName: string;
}): string {
  const safeName = sanitizeReceiptProofFileName(input.fileName);
  return `receipts/${input.tenantId}/${input.registrationId}/${safeName}`;
}

export function assertMemberReceiptProofKeyScope(
  storageKey: string,
  tenantId: string
): void {
  const prefix = `receipts/${tenantId}/`;
  if (!storageKey.startsWith(prefix)) {
    throw new Error("RECEIPT_PROOF_KEY_SCOPE_INVALID");
  }
}

export function assertMemberReceiptProofContentType(contentType: string): void {
  const normalized = contentType.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  if (!ALLOWED_CONTENT_TYPES.has(normalized)) {
    throw new Error("RECEIPT_PROOF_CONTENT_TYPE_INVALID");
  }
}

function readMinioSdkErrorCode(error: unknown): string | null {
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

/** Stable upload failure codes — map MinIO/network faults to 503 at HTTP boundary. */
export function rethrowMemberReceiptProofStorageError(error: unknown): never {
  const minioCode = readMinioSdkErrorCode(error);
  if (minioCode === "XMinioStorageFull") {
    throw new Error("RECEIPT_STORAGE_FULL");
  }
  if (
    minioCode === "NoSuchBucket" ||
    minioCode === "NoSuchKey" ||
    minioCode === "InvalidBucketName" ||
    minioCode === "AccessDenied"
  ) {
    throw new Error("RECEIPT_STORAGE_UNAVAILABLE");
  }
  if (error instanceof Error && /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(error.message)) {
    throw new Error("RECEIPT_STORAGE_UNAVAILABLE");
  }
  throw error;
}

export async function putMemberReceiptProof(input: {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly body: Buffer;
  readonly contentType: string;
  readonly fileName: string;
}): Promise<{ readonly storageKey: string }> {
  assertMemberReceiptProofContentType(input.contentType);
  if (input.body.length === 0) {
    throw new Error("RECEIPT_PROOF_EMPTY");
  }
  if (input.body.length > MEMBER_RECEIPT_PROOF_MAX_BYTES) {
    throw new Error("RECEIPT_PROOF_TOO_LARGE");
  }

  const config = readTenantBrandLogoMinioConfigFromEnv();
  const storageKey = buildMemberReceiptProofObjectKey({
    tenantId: input.tenantId,
    registrationId: input.registrationId,
    fileName: input.fileName,
  });
  assertMemberReceiptProofKeyScope(storageKey, input.tenantId);

  if (config === null) {
    if (process.env.STORAGE_DRIVER === "memory" && process.env.NODE_ENV === "development") {
      memoryReceiptProofStore.set(storageKey, Buffer.from(input.body));
      return { storageKey };
    }
    throw new Error("MINIO_NOT_CONFIGURED");
  }

  await ensureTenantBrandLogoBucket(config).catch(rethrowMemberReceiptProofStorageError);
  const client = createTenantBrandLogoMinioClient(config);
  const contentType =
    input.contentType.trim().toLowerCase().split(";")[0]?.trim() ?? "application/octet-stream";
  try {
    await client.putObject(config.bucket, storageKey, input.body, input.body.length, {
      "Content-Type": contentType,
    });
  } catch (error) {
    rethrowMemberReceiptProofStorageError(error);
  }
  return { storageKey };
}

export async function getMemberReceiptProofSignedReadUrl(input: {
  readonly tenantId: string;
  readonly storageKey: string;
  readonly expiresInSeconds?: number;
}): Promise<string> {
  assertMemberReceiptProofKeyScope(input.storageKey, input.tenantId);
  const config = readTenantBrandLogoMinioConfigFromEnv();
  if (config === null) {
    if (
      process.env.STORAGE_DRIVER === "memory" &&
      process.env.NODE_ENV === "development" &&
      memoryReceiptProofStore.has(input.storageKey)
    ) {
      return `memory://receipt-proof/${input.storageKey}`;
    }
    throw new Error("MINIO_NOT_CONFIGURED");
  }
  const presignConfig = resolveMinioPhotoPresignConfig(config);
  const client = createTenantBrandLogoMinioClient(presignConfig);
  return client.presignedGetObject(
    presignConfig.bucket,
    input.storageKey,
    input.expiresInSeconds ?? RECEIPT_PROOF_READ_URL_TTL_SECONDS
  );
}
