import { z } from "zod";

export const DENALI_MAX_PHOTO_COUNT = 10;

export const DENALI_MAX_PHOTO_UPLOAD_BYTES = 5 * 1024 * 1024;

export const DENALI_PHOTO_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type DenaliPhotoContentType = (typeof DENALI_PHOTO_ALLOWED_CONTENT_TYPES)[number];

export function isDenaliPhotoContentType(value: string): value is DenaliPhotoContentType {
  return (DENALI_PHOTO_ALLOWED_CONTENT_TYPES as readonly string[]).includes(value);
}

/** External gallery URL — HTTPS only (no javascript:, mixed-content, or arbitrary schemes). */
export function isDenaliHttpsImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Catalog itinerary/gallery projection — HTTPS images plus deterministic `data:image/*`
 * smoke fixtures (avoid DNS to placeholder CDNs in operator/admin seeds).
 */
export function isDenaliCatalogProjectableImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (isDenaliHttpsImageUrl(trimmed)) {
    return true;
  }
  return /^data:image\/[a-z0-9.+-]+[,;]/i.test(trimmed);
}

/** Canonical tour photo row — MinIO `storageKey` preferred; external `url` kept as fallback. */
export const denaliImageFileAssetSchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().optional(),
    storageKey: z.string().trim().min(1).optional(),
    url: z.string().trim().min(1).optional(),
    day: z.number().int().min(1).optional(),
    contentType: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const hasStorage = (value.storageKey?.trim().length ?? 0) > 0;
    const url = value.url?.trim() ?? "";
    const hasUrl = url.length > 0;
    if (!hasStorage && !hasUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "هر عکس باید storageKey یا url داشته باشد.",
        path: ["storageKey"],
      });
    }
    if (hasUrl && !isDenaliHttpsImageUrl(url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "آدرس تصویر باید با https:// شروع شود.",
        path: ["url"],
      });
    }
  });
