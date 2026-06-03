import {
  assertCanonicalDocument,
  CanonicalDocumentValidationError,
  type CanonicalDocument,
  type CanonicalDocumentValidationErrorCode,
} from "../canonical/canonical-document";
import { sdkErr, sdkOk, type SdkResult } from "../errors/sdk-result";
import {
  IngressSanitizationError,
  type IngressSanitizationErrorCode,
} from "../errors/ingress-sanitization-error";
import { deepCloneFreezeFromStorage, policyCanonicalDocument } from "./plain-tree";

const CANONICAL_VALIDATION_CODES = new Set<CanonicalDocumentValidationErrorCode>([
  "CANONICAL_INVALID_SCHEMA_VERSION",
  "CANONICAL_INVALID_ROOTS",
  "CANONICAL_DUPLICATE_ROOT",
  "CANONICAL_INVALID_DATA",
  "CANONICAL_ROOT_UNKNOWN",
]);

function throwCanonicalIngressFailure(
  result: SdkResult<CanonicalDocument, CanonicalIngressErrorCode> & { ok: false },
): never {
  const { code, message, path } = result.error;
  if (CANONICAL_VALIDATION_CODES.has(code as CanonicalDocumentValidationErrorCode)) {
    throw new CanonicalDocumentValidationError(
      code as CanonicalDocumentValidationErrorCode,
      message,
    );
  }
  throw new IngressSanitizationError(
    code as IngressSanitizationErrorCode,
    message,
    path ?? "document",
  );
}

export type CanonicalIngressErrorCode =
  | CanonicalDocumentValidationErrorCode
  | IngressSanitizationErrorCode;

export function tryParseCanonicalDocumentFromStorage(
  raw: unknown,
): SdkResult<CanonicalDocument, CanonicalIngressErrorCode> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return sdkErr(
      "CANONICAL_INVALID_DATA",
      "Stored canonical document must be a plain object",
    );
  }

  let sanitized: CanonicalDocument;
  try {
    sanitized = deepCloneFreezeFromStorage<CanonicalDocument>(
      raw,
      "document",
      policyCanonicalDocument(),
    );
  } catch (error: unknown) {
    if (error instanceof CanonicalDocumentValidationError) {
      return sdkErr(error.code, error.message);
    }
    if (error instanceof IngressSanitizationError) {
      return sdkErr(error.code, error.message, error.path);
    }
    return sdkErr(
      "INGRESS_REJECTED",
      error instanceof Error ? error.message : String(error),
      "document",
    );
  }

  try {
    assertCanonicalDocument(sanitized);
  } catch (error: unknown) {
    if (error instanceof CanonicalDocumentValidationError) {
      return sdkErr(error.code, error.message);
    }
    return sdkErr(
      "CANONICAL_INVALID_DATA",
      error instanceof Error ? error.message : String(error),
    );
  }

  return sdkOk(Object.freeze(sanitized));
}

export function parseCanonicalDocumentFromStorage(raw: unknown): CanonicalDocument {
  const result = tryParseCanonicalDocumentFromStorage(raw);
  if (!result.ok) {
    throwCanonicalIngressFailure(result);
  }
  return result.value;
}
