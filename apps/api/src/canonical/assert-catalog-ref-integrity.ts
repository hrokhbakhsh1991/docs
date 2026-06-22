import type { CanonicalDocument, WorkspaceViolation } from "@app-tour/workspace-sdk";

export type CatalogRefAllowlists = {
  readonly activeThemeIds: readonly string[];
  readonly selectableLeaderIds: readonly string[];
};

function readCanonicalPath(data: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = data;
  for (const segment of segments) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function parseStringArray(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  return [];
}

function assertAllowedIdsAtPath(
  data: Record<string, unknown>,
  canonicalPath: string,
  allowedIds: readonly string[],
  fieldId: string
): WorkspaceViolation | null {
  const selected = parseStringArray(readCanonicalPath(data, canonicalPath));
  if (selected.length === 0) {
    return null;
  }
  const allowed = new Set(allowedIds);
  const stale = selected.filter((id) => !allowed.has(id));
  if (stale.length === 0) {
    return null;
  }
  return {
    fieldId,
    code: "CATALOG_REF_INTEGRITY_FAILED",
    message: `CATALOG_REF_INTEGRITY_FAILED:${canonicalPath}:${stale.join(",")}`,
  };
}

/** P5-B-N-008 — reject stale theme/leader catalog refs on publish (server parity with client sanitize). */
export function assertCatalogRefIntegrity(
  document: CanonicalDocument,
  allowlists: CatalogRefAllowlists
): WorkspaceViolation | null {
  const data = document.data as Record<string, unknown>;
  const themeViolation = assertAllowedIdsAtPath(
    data,
    "program.themeIds",
    allowlists.activeThemeIds,
    "program.themeIds"
  );
  if (themeViolation != null) {
    return themeViolation;
  }
  return assertAllowedIdsAtPath(
    data,
    "leaderUserIds",
    allowlists.selectableLeaderIds,
    "leaderUserIds"
  );
}
