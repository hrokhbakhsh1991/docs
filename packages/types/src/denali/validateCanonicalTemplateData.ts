import type { z } from "zod";

import type { DenaliCanonicalTemplateData } from "./denaliTemplateSchema";
import { denaliCanonicalTemplateDataSchema } from "./denaliCanonicalTemplateDataSchema";
import {
  formatDenaliTemplatePathSuggestion,
} from "./denaliTemplateStoragePaths";
import { DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS } from "./denali-canonical-template-keys";
import type { DenaliCanonicalTourModel } from "./denaliCanonicalTourModel";
import { sanitizeDenaliCanonicalTemplateData } from "./templateCanonicalMapping";

export { DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS } from "./denali-canonical-template-keys";
export { denaliCanonicalTemplateDataSchema } from "./denaliCanonicalTemplateDataSchema";

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

function zodPathToDotPath(path: readonly PropertyKey[]): string {
  return path
    .map((segment) => (typeof segment === "number" ? String(segment) : String(segment)))
    .join(".");
}

function mapZodIssue(issue: z.ZodIssue): DenaliCanonicalTemplateValidationIssue {
  const dotPath = zodPathToDotPath(issue.path);

  if (issue.code === "unrecognized_keys") {
    const unknownKey = issue.keys[0] ?? dotPath;
    const fullPath = dotPath ? `${dotPath}.${String(unknownKey)}` : String(unknownKey);
    return {
      path: fullPath,
      message: formatDenaliTemplatePathSuggestion(fullPath),
    };
  }

  return {
    path: dotPath || "<root>",
    message: issue.message,
  };
}

/**
 * Validates workspace template `canonicalData` as a strict deep-partial subset of the
 * wizard canonical tour schema. Unknown keys fail loudly with canonical path hints.
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

  const parsed = denaliCanonicalTemplateDataSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(mapZodIssue) };
  }

  return { ok: true, data: sanitizeDenaliCanonicalTemplateData(parsed.data) };
}

export {
  formatDenaliTemplatePathSuggestion,
  suggestDenaliTemplateStoragePath,
  toDenaliTemplateStoragePath,
  listDenaliTemplateLegacyOverlayPaths,
  DENALI_TEMPLATE_RULE_PATH_TO_STORAGE_PATH,
} from "./denaliTemplateStoragePaths";

/** Ensures template allow-list tracks {@link DenaliCanonicalTourModel} top-level keys. */
export type AssertTemplateKeysMatchCanonicalModel =
  Exclude<keyof DenaliCanonicalTourModel, (typeof DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS)[number]> extends never
    ? Exclude<(typeof DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS)[number], keyof DenaliCanonicalTourModel> extends never
      ? true
      : never
    : never;

export const TEMPLATE_SCHEMA_ALIGNED_WITH_CANONICAL_MODEL: AssertTemplateKeysMatchCanonicalModel = true;
