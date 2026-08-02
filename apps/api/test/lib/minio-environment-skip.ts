/**
 * Classify MinIO / object-storage failures as environment (skip) vs product.
 * Live round-trip suites must not red the memory trunk when the bucket is full or unreachable.
 */

export function isMinioEnvironmentFailure(error: unknown): boolean {
  if (error === null || typeof error !== "object") {
    return false;
  }
  const code =
    "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : null;
  if (code === "XMinioStorageFull" || code === "ECONNREFUSED" || code === "ENOTFOUND") {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message;
  return (
    message === "PHOTO_STORAGE_FULL" ||
    message === "MINIO_NOT_CONFIGURED" ||
    message.includes("minimum free drive threshold") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND")
  );
}

export function minioEnvironmentSkipReason(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `MinIO environment: ${error.message}`;
  }
  return "MinIO environment: unavailable";
}
