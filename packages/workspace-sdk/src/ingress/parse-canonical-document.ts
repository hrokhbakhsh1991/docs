import {
  assertCanonicalDocument,
  CanonicalDocumentValidationError,
  freezeCanonicalDocumentData,
  type CanonicalDocument,
} from "../canonical/canonical-document";

export function parseCanonicalDocumentFromStorage(raw: unknown): CanonicalDocument {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new CanonicalDocumentValidationError(
      "CANONICAL_INVALID_DATA",
      "Stored canonical document must be a plain object",
    );
  }
  const candidate = raw as CanonicalDocument;
  assertCanonicalDocument(candidate);
  return {
    schemaVersion: candidate.schemaVersion,
    roots: candidate.roots,
    data: freezeCanonicalDocumentData(candidate.data),
  };
}
