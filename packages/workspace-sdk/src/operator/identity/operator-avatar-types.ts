/** Raster operator profile avatar limits (identity plane). */
export const OPERATOR_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const OPERATOR_AVATAR_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type OperatorAvatarContentType =
  (typeof OPERATOR_AVATAR_ALLOWED_CONTENT_TYPES)[number];

export function isOperatorAvatarContentType(
  value: string
): value is OperatorAvatarContentType {
  return (OPERATOR_AVATAR_ALLOWED_CONTENT_TYPES as readonly string[]).includes(
    value.trim().toLowerCase()
  );
}
