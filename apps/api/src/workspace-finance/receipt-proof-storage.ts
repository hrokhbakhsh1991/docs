import { createHash } from "node:crypto";

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

/**
 * Dev-only accessor so the local HTTP server can actually serve the bytes that
 * `getMemberReceiptProofSignedReadUrl` points at when STORAGE_DRIVER=memory.
 * Without this, the returned `memory://...` URL is not loadable by a browser
 * <img> tag and reviewers can never see the uploaded receipt locally.
 */
export function readMemoryReceiptProof(storageKey: string): Buffer | null {
  return memoryReceiptProofStore.get(storageKey) ?? null;
}

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function isMemoryReceiptProofStoreEnabled(): boolean {
  return process.env.STORAGE_DRIVER === "memory" && process.env.NODE_ENV !== "production";
}

export function sanitizeReceiptProofFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "receipt";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "receipt.bin";
}

export function buildMemberReceiptProofObjectKey(input: {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly fileName: string;
  readonly contentHash?: string;
}): string {
  const safeName = sanitizeReceiptProofFileName(input.fileName);
  const suffix = input.contentHash === undefined ? "" : `-${input.contentHash.slice(0, 32)}`;
  return `receipts/${input.tenantId}/${input.registrationId}/${safeName}${suffix}`;
}

export function assertMemberReceiptProofKeyScope(storageKey: string, tenantId: string): void {
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
    minioCode === "NotFound" ||
    minioCode === "InvalidBucketName" ||
    minioCode === "AccessDenied"
  ) {
    throw new Error("RECEIPT_STORAGE_UNAVAILABLE");
  }
  if (
    error instanceof Error &&
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(error.message)
  ) {
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
    contentHash: createHash("sha256").update(input.body).digest("hex"),
  });
  assertMemberReceiptProofKeyScope(storageKey, input.tenantId);

  if (config === null) {
    if (isMemoryReceiptProofStoreEnabled()) {
      if (!memoryReceiptProofStore.has(storageKey)) {
        memoryReceiptProofStore.set(storageKey, Buffer.from(input.body));
      }
      return { storageKey };
    }
    throw new Error("MINIO_NOT_CONFIGURED");
  }

  await ensureTenantBrandLogoBucket(config).catch(rethrowMemberReceiptProofStorageError);
  const client = createTenantBrandLogoMinioClient(config);
  const contentType =
    input.contentType.trim().toLowerCase().split(";")[0]?.trim() ?? "application/octet-stream";
  try {
    try {
      await client.statObject(config.bucket, storageKey);
      return { storageKey };
    } catch (error) {
      const code = readMinioSdkErrorCode(error);
      if (code !== "NoSuchKey" && code !== "NotFound") {
        rethrowMemberReceiptProofStorageError(error);
      }
    }
    await client.putObject(config.bucket, storageKey, input.body, input.body.length, {
      "Content-Type": contentType,
    });
  } catch (error) {
    rethrowMemberReceiptProofStorageError(error);
  }
  return { storageKey };
}

export async function deleteMemberReceiptProof(input: {
  readonly tenantId: string;
  readonly storageKey: string;
}): Promise<void> {
  assertMemberReceiptProofKeyScope(input.storageKey, input.tenantId);
  const config = readTenantBrandLogoMinioConfigFromEnv();
  if (config === null) {
    if (isMemoryReceiptProofStoreEnabled()) {
      memoryReceiptProofStore.delete(input.storageKey);
    }
    return;
  }
  const presignConfig = resolveMinioPhotoPresignConfig(config);
  const client = createTenantBrandLogoMinioClient(presignConfig);
  await client.removeObject(presignConfig.bucket, input.storageKey);
}

export async function getMemberReceiptProofSignedReadUrl(input: {
  readonly tenantId: string;
  readonly storageKey: string;
  readonly expiresInSeconds?: number;
}): Promise<string> {
  assertMemberReceiptProofKeyScope(input.storageKey, input.tenantId);
  const config = readTenantBrandLogoMinioConfigFromEnv();
  if (config === null) {
    if (isMemoryReceiptProofStoreEnabled() && memoryReceiptProofStore.has(input.storageKey)) {
      const port = process.env.PORT?.trim() || "3001";
      return `http://127.0.0.1:${port}/internal/dev/receipt-proof/${encodeURIComponent(input.storageKey)}`;
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

function receiptProofContentTypeFromKey(storageKey: string): string {
  const normalized = storageKey.toLowerCase().split("?")[0] ?? storageKey.toLowerCase();
  if (normalized.endsWith(".pdf")) return "application/pdf";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".gif")) return "image/gif";
  return "image/png";
}

/** Read receipt bytes inside the API so Telegram never has to reach private MinIO. */
export async function readMemberReceiptProof(input: {
  readonly tenantId: string;
  readonly storageKey: string;
}): Promise<{ readonly body: Buffer; readonly contentType: string; readonly fileName: string }> {
  assertMemberReceiptProofKeyScope(input.storageKey, input.tenantId);
  const fileName = input.storageKey.split("/").pop() || "receipt";
  const contentType = receiptProofContentTypeFromKey(input.storageKey);

  const config = readTenantBrandLogoMinioConfigFromEnv();
  if (config === null) {
    if (isMemoryReceiptProofStoreEnabled()) {
      const body = memoryReceiptProofStore.get(input.storageKey);
      if (body !== undefined) return { body: Buffer.from(body), contentType, fileName };
    }
    throw new Error("RECEIPT_STORAGE_UNAVAILABLE");
  }

  const client = createTenantBrandLogoMinioClient(config);
  try {
    const stream = await client.getObject(config.bucket, input.storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);
    if (body.length === 0) throw new Error("RECEIPT_PROOF_EMPTY");
    return { body, contentType, fileName };
  } catch (error: unknown) {
    rethrowMemberReceiptProofStorageError(error);
  }
}
