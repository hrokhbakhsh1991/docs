/**
 * Generic persisted wizard document — target SoT for Phase 4a (`map.md`).
 *
 * Adapters in `apps/api` may map to/from profile-specific wire types; this
 * package stays free of workspace-specific model names.
 */
export interface CanonicalDocument {
  readonly schemaVersion: number;
  /** Top-level keys allowed in {@link CanonicalDocument.data}. */
  readonly roots: readonly string[];
  readonly data: Readonly<Record<string, unknown>>;
}

export class CanonicalDocumentValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CanonicalDocumentValidationError";
    this.code = code;
  }
}

/** Ensures every key in `data` is declared in `roots`. */
export function assertCanonicalDocumentRoots(document: CanonicalDocument): void {
  const allowed = new Set(document.roots);
  for (const key of Object.keys(document.data)) {
    if (!allowed.has(key)) {
      throw new CanonicalDocumentValidationError(
        "CANONICAL_ROOT_UNKNOWN",
        `Key "${key}" is not listed in document.roots`,
      );
    }
  }
}

export function createCanonicalDocument(input: {
  schemaVersion: number;
  roots: readonly string[];
  data: Record<string, unknown>;
}): CanonicalDocument {
  const document: CanonicalDocument = {
    schemaVersion: input.schemaVersion,
    roots: input.roots,
    data: input.data,
  };
  assertCanonicalDocumentRoots(document);
  return document;
}
