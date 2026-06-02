import { BadRequestException } from "@nestjs/common";

/**
 * RFC 7232-style parsing for our weak numeric profile ETag (`GET /api/v2/me`).
 * Supports `W/"123"`, `"123"`, or bare `123`. Returns undefined when absent/ignored.
 *
 * Throws {@link BadRequestException} when a non-empty header is malformed.
 */
export function resolveExpectedProfileRowVersionFromIfMatchHeader(
  ifMatchRaw: string | string[] | undefined
): number | undefined {
  if (!ifMatchRaw) {
    return undefined;
  }
  const inner = Array.isArray(ifMatchRaw) ? String(ifMatchRaw[0] ?? "").trim() : String(ifMatchRaw).trim();

  const firstComma = inner.indexOf(",");
  const head =
    firstComma === -1
      ? inner.trim()
      : inner
          .slice(0, firstComma)
          .trim();

  const t = head;
  if (t === "") {
    return undefined;
  }
  if (t === "*") {
    return undefined;
  }

  const candidates = [
    /^W\s*\/\s*"\s*(?<n>[0-9]+)\s*"$/iu,
    /^"\s*(?<n>[0-9]+)\s*"$/u,
    /^(?<n>[0-9]+)$/u
  ];

  let nStr: string | undefined;
  for (const rx of candidates) {
    const m = rx.exec(t);
    const g = m?.groups?.n;
    if (g !== undefined && g.trim() !== "") {
      nStr = g.trim();
      break;
    }
  }

  if (nStr === undefined || nStr.trim() === "") {
    throw new BadRequestException({
      error: {
        code: "VALIDATION_FIELD_FORMAT_INVALID",
        message:
          'If-Match must be a weak numeric tag like W/"123", a quoted numeric tag, or a bare profile row version string.'
      }
    });
  }

  const n = Number.parseInt(nStr, 10);
  if (!Number.isSafeInteger(n) || n < 1) {
    throw new BadRequestException({
      error: {
        code: "VALIDATION_FIELD_FORMAT_INVALID",
        message: "If-Match version must be a positive integer profile row version."
      }
    });
  }
  return n;
}
