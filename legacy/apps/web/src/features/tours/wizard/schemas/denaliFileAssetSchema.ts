import { z } from "zod";

export const DENALI_FILE_UPLOAD_STATUS = [
  "pending",
  "uploading",
  "uploaded",
  "failed",
] as const;

export const DENALI_ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const DENALI_MAX_PHOTO_COUNT = 10;
export const DENALI_MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

export const denaliFileAssetSchema = z.object({
  id: z.string().trim().min(1),
  url: z.string().trim().min(1),
  filename: z.string().trim().min(1),
  size: z.number().nonnegative(),
  mimeType: z.string().trim().min(1),
  uploadedAt: z.string().trim().min(1),
  assetId: z.string().trim().min(1).optional(),
  uploadStatus: z.enum(DENALI_FILE_UPLOAD_STATUS).optional(),
});

export type DenaliFileAsset = z.infer<typeof denaliFileAssetSchema>;

export const denaliImageFileAssetSchema = denaliFileAssetSchema
  .refine(
    (row) => row.size <= DENALI_MAX_PHOTO_SIZE_BYTES,
    "حجم هر فایل باید حداکثر ۵ مگابایت باشد.",
  )
  .refine(
    (row) => DENALI_ALLOWED_IMAGE_MIME_TYPES.includes(row.mimeType as (typeof DENALI_ALLOWED_IMAGE_MIME_TYPES)[number]),
    "فرمت فایل باید jpg یا png یا webp باشد.",
  );
