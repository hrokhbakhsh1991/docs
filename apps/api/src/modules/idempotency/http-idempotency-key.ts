import { BadRequestException } from "@nestjs/common";

/** Keys are stored in Postgres as `varchar`; reject oversized or binary-looking payloads early. */
export const HTTP_IDEMPOTENCY_KEY_MAX_LENGTH = 256;
export const HTTP_IDEMPOTENCY_KEY_PATTERN = /^[\w.~\-]{1,256}$/u;

function trimKey(raw: string | string[] | undefined): string {
  if (raw === undefined) return "";
  const s = Array.isArray(raw) ? raw[0] : raw;
  return typeof s === "string" ? s.trim() : "";
}

/**
 * Validates format when a key is present (same rules as {@link IdempotencyInterceptor}).
 * @throws BadRequestException when non-empty but invalid
 */
export function assertHttpIdempotencyKeyFormat(idempotencyKey: string): void {
  if (
    idempotencyKey.length > HTTP_IDEMPOTENCY_KEY_MAX_LENGTH ||
    !HTTP_IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)
  ) {
    throw new BadRequestException({
      error: {
        code: "VALIDATION_FIELD_FORMAT_INVALID",
        message:
          "Idempotency-Key must be 1–256 characters and contain only letters, digits, underscore, hyphen, or period."
      }
    });
  }
}

/**
 * **Public registration / waitlist:** Idempotency-Key is mandatory (replay-safe placement + payment intent).
 * Accepts the raw Nest `@Headers("idempotency-key")` value (Express lowercases header names).
 */
export function assertPublicRegistrationIdempotencyKey(
  idempotencyKeyRaw: string | string[] | undefined
): string {
  const key = trimKey(idempotencyKeyRaw);
  if (!key) {
    throw new BadRequestException({
      error: {
        code: "VALIDATION_REQUIRED_FIELD_MISSING",
        message:
          "Idempotency-Key header is required for public registration endpoints. Use a fresh value per attempt (UUID recommended), or GET /api/v2/tours/{tourId}/registration-idempotency-key for a server-suggested key."
      }
    });
  }
  assertHttpIdempotencyKeyFormat(key);
  return key;
}
