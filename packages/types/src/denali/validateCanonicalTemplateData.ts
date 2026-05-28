import type { DenaliCanonicalTourModel } from "./denaliCanonicalTourModel";
import type { DenaliCanonicalTemplateData } from "./denaliTemplateSchema";

import { DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS } from "./denali-canonical-template-keys";
import { sanitizeDenaliCanonicalTemplateData } from "./templateCanonicalMapping";

export { DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS } from "./denali-canonical-template-keys";

export type DenaliCanonicalTemplateValidationIssue = {
  path: string;
  message: string;
};

export type DenaliCanonicalTemplateValidationResult =
  | { ok: true; data: DenaliCanonicalTemplateData }
  | { ok: false; issues: DenaliCanonicalTemplateValidationIssue[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Strips unknown top-level keys and returns a partial canonical payload safe for JSONB storage.
 * Nested shape validation is intentionally permissive (wizard rule engine normalizes on hydrate).
 */
export function validateDenaliCanonicalTemplateData(
  value: unknown,
): DenaliCanonicalTemplateValidationResult {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      issues: [{ path: "<root>", message: "canonicalData must be a JSON object" }],
    };
  }

  const allowed = new Set<string>(DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS);
  const issues: DenaliCanonicalTemplateValidationIssue[] = [];

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push({ path: key, message: "unknown canonical field (not in DenaliCanonicalTourModel)" });
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, data: sanitizeDenaliCanonicalTemplateData(value) };
}

/** Ensures template allow-list tracks {@link DenaliCanonicalTourModel} top-level keys. */
export type AssertTemplateKeysMatchCanonicalModel =
  Exclude<keyof DenaliCanonicalTourModel, (typeof DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS)[number]> extends never
    ? Exclude<(typeof DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS)[number], keyof DenaliCanonicalTourModel> extends never
      ? true
      : never
    : never;

export const TEMPLATE_SCHEMA_ALIGNED_WITH_CANONICAL_MODEL: AssertTemplateKeysMatchCanonicalModel = true;
