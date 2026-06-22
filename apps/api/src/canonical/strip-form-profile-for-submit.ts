import {
  createCanonicalDocument,
  type CanonicalDocument,
} from "@app-tour/workspace-sdk";
import { DENALI_COMPOSITE_DEPENDENT_PATHS } from "@app-tour/workspace-denali/composites";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deleteCanonicalPath(target: Record<string, unknown>, path: string): void {
  const parts = path.split(".");
  if (parts.length === 1) {
    delete target[parts[0]!];
    return;
  }

  let current: Record<string, unknown> = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]!;
    const next = current[part];
    if (!isRecord(next)) {
      return;
    }
    current = next;
  }
  delete current[parts[parts.length - 1]!];
}

/** P5-B-N-007 — remove composite-dependent ghost keys clients must not persist separately. */
export function stripFormProfileFieldsFromCanonicalData(
  workspaceType: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (workspaceType !== "denali") {
    return data;
  }

  const next = structuredClone(data);
  for (const path of DENALI_COMPOSITE_DEPENDENT_PATHS) {
    deleteCanonicalPath(next, path);
  }
  return next;
}

/** Drop composite-dependent wizard roots after data strip (INV-DENALI-WIZ-003). */
export function filterDenaliRootsAfterProfileStrip(
  roots: readonly string[],
  data: Record<string, unknown>
): readonly string[] {
  return roots.filter((root) => !DENALI_COMPOSITE_DEPENDENT_PATHS.has(root) && root in data);
}

/** Strip non-persistable profile fields before canonical document assembly / persist. */
export function stripFormProfileForSubmit(
  workspaceType: string,
  document: CanonicalDocument
): CanonicalDocument {
  const data = document.data as Record<string, unknown>;
  const stripped = stripFormProfileFieldsFromCanonicalData(workspaceType, data);
  if (stripped === data) {
    return document;
  }
  const roots =
    workspaceType === "denali"
      ? filterDenaliRootsAfterProfileStrip(document.roots, stripped)
      : document.roots;
  return createCanonicalDocument({
    schemaVersion: document.schemaVersion,
    roots: [...roots],
    data: stripped,
  });
}
