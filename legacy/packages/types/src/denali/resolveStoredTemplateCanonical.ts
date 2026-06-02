import type { DenaliCanonicalTemplateData } from "./denaliTemplateSchema";
import {
  collectDiscardedTemplateKeys,
  templateToCanonical,
  type SanitizeDenaliCanonicalTemplateOptions,
} from "./templateCanonicalMapping";
import { formatDenaliTemplatePathSuggestion } from "./denaliTemplateStoragePaths";
import {
  validateDenaliCanonicalTemplateData,
  type DenaliCanonicalTemplateValidationIssue,
} from "./validateCanonicalTemplateData";

export type StoredTemplateCanonicalRow = {
  canonicalData: unknown;
  fieldRulesOverlay?: unknown;
  stepOverrides?: unknown;
};

export type ResolveStoredTemplateCanonicalOptions = SanitizeDenaliCanonicalTemplateOptions;

export type ResolvedStoredTemplateCanonical =
  | { ok: true; canonicalData: DenaliCanonicalTemplateData }
  | { ok: false; issues: readonly DenaliCanonicalTemplateValidationIssue[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Normalizes persisted template JSONB via {@link templateToCanonical}, then validates
 * against Layer A strict schema. Rejects top-level fossil keys (no silent strip).
 */
export function resolveStoredTemplateCanonical(
  row: StoredTemplateCanonicalRow,
  options?: ResolveStoredTemplateCanonicalOptions,
): ResolvedStoredTemplateCanonical {
  if (!isPlainObject(row.canonicalData)) {
    return {
      ok: false,
      issues: [{ path: "<root>", message: "canonicalData must be a JSON object" }],
    };
  }

  const discardedTopLevel = collectDiscardedTemplateKeys(row.canonicalData);
  if (discardedTopLevel.length > 0) {
    return {
      ok: false,
      issues: discardedTopLevel.map((key) => ({
        path: key,
        message:
          formatDenaliTemplatePathSuggestion(key) ||
          `Top-level fossil key "${key}" is not allowed in canonicalData`,
      })),
    };
  }

  const sanitized = templateToCanonical(
    {
      canonicalData: row.canonicalData,
      fieldRulesOverlay: row.fieldRulesOverlay,
      stepOverrides: row.stepOverrides,
    },
    options,
  );

  const validation = validateDenaliCanonicalTemplateData(sanitized);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues };
  }

  return { ok: true, canonicalData: validation.data };
}
