import type { CanonicalDocument } from "@app-tour/workspace-sdk";

import { WORKSPACE_CANONICAL_TOUR_BINDINGS } from "./workspace-canonical-tour-bindings.generated";

export type TourPublishTransitionKind = "published" | "unpublished";

type CanonicalTourBinding = (typeof WORKSPACE_CANONICAL_TOUR_BINDINGS)[number];

function buildBindingMap(): Readonly<Record<string, CanonicalTourBinding>> {
  const map: Record<string, CanonicalTourBinding> = {};
  for (const binding of WORKSPACE_CANONICAL_TOUR_BINDINGS) {
    map[binding.workspaceType as string] = binding;
  }
  return Object.freeze(map);
}

const bindingsByWorkspaceType = buildBindingMap();

function resolveBinding(workspaceType: string | undefined): CanonicalTourBinding | undefined {
  if (workspaceType === undefined) {
    return undefined;
  }
  return bindingsByWorkspaceType[workspaceType];
}

function canonicalDataRecord(
  canonical: CanonicalDocument
): Record<string, unknown> | undefined {
  const data = canonical.data;
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  return data as Record<string, unknown>;
}

export function readTourPublishStatusLabel(
  workspaceType: string | undefined,
  canonical: CanonicalDocument
): string | undefined {
  const binding = resolveBinding(workspaceType);
  if (binding === undefined) {
    return undefined;
  }
  return binding.readPublishStatusFromCanonical(canonical);
}

export function detectTourPublishTransition(
  workspaceType: string | undefined,
  before: CanonicalDocument,
  after: CanonicalDocument
): TourPublishTransitionKind | null {
  const binding = resolveBinding(workspaceType);
  if (binding === undefined) {
    return null;
  }
  const beforeData = canonicalDataRecord(before);
  const afterData = canonicalDataRecord(after);
  if (beforeData === undefined || afterData === undefined) {
    return null;
  }
  return binding.detectPublishTransition(beforeData, afterData);
}

export type MigrateCanonicalHook = (
  schemaVersion: number,
  data: unknown
) => CanonicalDocument;

export const migrateCanonicalNotImplemented: MigrateCanonicalHook = () => {
  throw new Error("MIGRATE_CANONICAL_NOT_IMPLEMENTED_PHASE_5");
};

export function resolveMigrateCanonicalHook(workspaceType: string): MigrateCanonicalHook {
  const binding = resolveBinding(workspaceType);
  if (binding === undefined || !("migrateCanonical" in binding)) {
    return migrateCanonicalNotImplemented;
  }
  return binding.migrateCanonical as MigrateCanonicalHook;
}

export function resolveFormProfileGhostPaths(
  workspaceType: string | undefined
): ReadonlySet<string> | undefined {
  const binding = resolveBinding(workspaceType);
  if (binding === undefined || !("formProfileGhostPaths" in binding)) {
    return undefined;
  }
  return binding.formProfileGhostPaths;
}

/** Workspaces that must run canonical validation on the request thread (worker IPC cannot load host rules). */
export function requiresValidationSync(workspaceType: string | undefined): boolean {
  const binding = resolveBinding(workspaceType);
  return binding !== undefined && "validationSyncOnly" in binding && binding.validationSyncOnly === true;
}

export function requiresCatalogRefEnrichment(workspaceType: string | undefined): boolean {
  const binding = resolveBinding(workspaceType);
  return binding !== undefined && "catalogRefEnrichment" in binding && binding.catalogRefEnrichment === true;
}
