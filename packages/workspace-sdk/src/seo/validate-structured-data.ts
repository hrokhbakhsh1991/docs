/**
 * Minimal JSON-LD shape checks for workspace catalog structured data.
 * @see docs/dev/guest-seo-conformance.md — structured data validation
 */

export type StructuredDataValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: readonly string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Fail-closed validator for egress-safe catalog JSON-LD blobs. */
export function validateStructuredData(json: unknown): StructuredDataValidationResult {
  const errors: string[] = [];

  if (!isRecord(json)) {
    return { ok: false, errors: ["STRUCTURED_DATA_NOT_OBJECT"] };
  }

  const context = readNonEmptyString(json["@context"]);
  if (context !== "https://schema.org") {
    errors.push("STRUCTURED_DATA_INVALID_CONTEXT");
  }

  const type = readNonEmptyString(json["@type"]);
  if (type === null) {
    errors.push("STRUCTURED_DATA_TYPE_REQUIRED");
  }

  const name = readNonEmptyString(json.name);
  if (name === null) {
    errors.push("STRUCTURED_DATA_NAME_REQUIRED");
  }

  if (errors.length > 0) {
    return { ok: false, errors: Object.freeze(errors) };
  }

  return { ok: true };
}
