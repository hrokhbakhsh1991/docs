import {
  assertCanonicalDocument,
  CanonicalDocumentValidationError,
  type CanonicalDocument,
} from "../canonical/canonical-document";
import { deepCloneFreezeFromStorage } from "./ingress-storage-sanitizer";

function wrapIngressError(error: unknown): never {
  if (error instanceof CanonicalDocumentValidationError) {
    throw error;
  }
  const message = error instanceof Error ? error.message : String(error);
  throw new CanonicalDocumentValidationError("CANONICAL_INVALID_DATA", message);
}

export function parseCanonicalDocumentFromStorage(raw: unknown): CanonicalDocument {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new CanonicalDocumentValidationError(
      "CANONICAL_INVALID_DATA",
      "Stored canonical document must be a plain object",
    );
  }

  let sanitized: CanonicalDocument;
  try {
    sanitized = deepCloneFreezeFromStorage<CanonicalDocument>(raw, "document", {
      allowArrays: true,
    });
  } catch (error: unknown) {
    wrapIngressError(error);
  }
  assertCanonicalDocument(sanitized);
  return Object.freeze(sanitized);
}
