import {
  createCanonicalDocument,
  parseCanonicalDocumentFromStorage,
  type CanonicalDocument,
} from "@app-tour/workspace-sdk";

/**
 * Phase 3.4 — web interacts with canonical documents only (no legacy table shapes).
 */
export class CanonicalClientService {
  parseIncomingDraft(raw: unknown): CanonicalDocument {
    return parseCanonicalDocumentFromStorage(raw);
  }

  createDraft(input: {
    readonly schemaVersion?: number;
    readonly roots: readonly string[];
    readonly data: Readonly<Record<string, unknown>>;
  }): CanonicalDocument {
    return createCanonicalDocument({
      schemaVersion: input.schemaVersion ?? 1,
      roots: [...input.roots],
      data: input.data,
    });
  }
}

export const canonicalClientService = new CanonicalClientService();
