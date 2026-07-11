import type { WorkspaceFieldRegistryEntry } from "../registry/field-registry";
import type { WorkspacePlugin } from "../plugin/workspace-plugin";

const ARRAY_CANONICAL_PATHS = new Set([
  "program.themeIds",
  "program.guideLanguageIds",
  "leaderUserIds",
  "photos",
  "program.itinerary",
  "gatheringPoints",
  "participants.gearItems",
  "tripDetails.logistics.includedServices",
  "tripDetails.logistics.excludedServices",
  "tripDetails.overview.customServiceLabels",
]);

function isArrayCanonicalPath(canonicalPath: string, kind: WorkspaceFieldRegistryEntry["kind"]): boolean {
  if (ARRAY_CANONICAL_PATHS.has(canonicalPath)) {
    return true;
  }
  if (kind === "composite" && canonicalPath.endsWith("Ids")) {
    return true;
  }
  return false;
}

function parseArrayDefault(trimmed: string): readonly string[] | null {
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        return null;
      }
      const items = parsed
        .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry).trim()))
        .filter((entry) => entry.length > 0);
      return items.length > 0 ? items : null;
    } catch {
      return null;
    }
  }
  if (trimmed.includes(",")) {
    const items = trimmed
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return items.length > 0 ? items : null;
  }
  return [trimmed];
}

function resolveRegistryField(
  plugin: Pick<WorkspacePlugin, "fieldRegistry"> | undefined,
  canonicalPath: string
): WorkspaceFieldRegistryEntry | undefined {
  return plugin?.fieldRegistry.fields.find((field) => field.canonicalPath === canonicalPath);
}

/** Coerce Settings `defaultValue` string to a canonical draft JSON value. */
export function coerceWizardTemplateDefaultValue(
  canonicalPath: string,
  raw: string,
  plugin?: Pick<WorkspacePlugin, "fieldRegistry">
): unknown | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const field = resolveRegistryField(plugin, canonicalPath);
  if (field == null) {
    if (isArrayCanonicalPath(canonicalPath, "composite")) {
      return parseArrayDefault(trimmed);
    }
    return trimmed;
  }

  if (isArrayCanonicalPath(field.canonicalPath, field.kind)) {
    return parseArrayDefault(trimmed);
  }

  switch (field.kind) {
    case "boolean":
      if (trimmed === "true" || trimmed === "false") {
        return trimmed;
      }
      return null;
    case "number":
      return /^\d+$/.test(trimmed) ? trimmed : null;
    case "enum":
      if (field.enumOptions != null && field.enumOptions.length > 0 && !field.enumOptions.includes(trimmed)) {
        return null;
      }
      return trimmed;
    case "text":
    case "date":
      return trimmed;
    case "composite":
      return parseArrayDefault(trimmed) ?? trimmed;
    default:
      return trimmed;
  }
}

/** True when `defaultValue` can be coerced for the registry field (INV-WIZ-012). */
export function isWizardTemplateDefaultValueCoercible(
  canonicalPath: string,
  raw: string,
  plugin?: Pick<WorkspacePlugin, "fieldRegistry">
): boolean {
  return coerceWizardTemplateDefaultValue(canonicalPath, raw, plugin) != null;
}
