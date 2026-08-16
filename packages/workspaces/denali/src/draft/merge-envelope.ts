import type { WorkspaceWizardDraftEnvelope, WorkspaceWizardDraftMeta } from "@app-tour/workspace-sdk";

import { DENALI_CANONICAL_OBJECT_ROOTS } from "../denali-plugin-adapter";
import { isDraftEssentiallyEmpty } from "../wizard/resolve-initial-step-index";

function readDeletedRoots(meta: WorkspaceWizardDraftMeta): readonly string[] | undefined {
  const raw = meta.deletedRoots;
  if (!Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }
  const roots = raw.filter((entry): entry is string => typeof entry === "string");
  return roots.length > 0 ? roots : undefined;
}

function readStepIndex(meta: WorkspaceWizardDraftMeta): number {
  const raw = meta.currentStepIndex;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function readSourceRowVersion(meta: WorkspaceWizardDraftMeta): number | undefined {
  const raw = meta.sourceRowVersion;
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyRootValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
}

function mergeRootValue(
  rootKey: string,
  localValue: unknown,
  serverValue: unknown
): unknown {
  if (!DENALI_CANONICAL_OBJECT_ROOTS.has(rootKey)) {
    return localValue;
  }
  if (!isRecord(localValue)) {
    return localValue;
  }
  if (!isRecord(serverValue)) {
    return localValue;
  }
  return { ...serverValue, ...localValue };
}

export function mergeCanonicalFormData(
  localData: Readonly<Record<string, unknown>> | undefined,
  serverData: Readonly<Record<string, unknown>> | undefined,
  deletedRoots: readonly string[] | undefined
): Record<string, unknown> {
  const deleted = new Set(deletedRoots ?? []);
  const local = localData ?? {};
  const server = serverData ?? {};
  const keys = new Set([...Object.keys(server), ...Object.keys(local)]);
  const merged: Record<string, unknown> = {};

  for (const key of keys) {
    if (deleted.has(key)) {
      continue;
    }
    const localValue = local[key];
    const serverValue = server[key];
    const localPresent = key in local;
    const serverPresent = key in server;

    if (localPresent && serverPresent) {
      merged[key] = mergeRootValue(key, localValue, serverValue);
      continue;
    }
    if (localPresent) {
      merged[key] = localValue;
      continue;
    }
    if (serverPresent) {
      merged[key] = serverValue;
    }
  }

  return merged;
}

export function trackDeletedCanonicalRoots(
  previousData: Readonly<Record<string, unknown>> | undefined,
  nextData: Readonly<Record<string, unknown>> | undefined,
  existingDeletedRoots?: readonly string[]
): readonly string[] | undefined {
  const previous = previousData ?? {};
  const next = nextData ?? {};
  const tombstones = new Set(existingDeletedRoots ?? []);

  for (const rootKey of DENALI_CANONICAL_OBJECT_ROOTS) {
    if (rootKey in previous && isNonEmptyRootValue(previous[rootKey]) && !(rootKey in next)) {
      tombstones.add(rootKey);
    }
  }

  if (tombstones.size === 0) {
    return existingDeletedRoots !== undefined && existingDeletedRoots.length > 0
      ? existingDeletedRoots
      : undefined;
  }
  return [...tombstones].sort();
}

function isFreshStartEnvelope<TForm>(
  envelope: WorkspaceWizardDraftEnvelope<TForm>
): boolean {
  return envelope.meta.freshStart === true;
}

/** True when local envelope is an explicit post-clear fresh start (OCC bypass). */
export function isDenaliFreshStartEnvelope<TForm>(
  envelope: WorkspaceWizardDraftEnvelope<TForm>
): boolean {
  return isFreshStartEnvelope(envelope);
}

export function mergeDenaliWizardDraftEnvelope<TForm>(
  local: WorkspaceWizardDraftEnvelope<TForm>,
  server: WorkspaceWizardDraftEnvelope<TForm>
): WorkspaceWizardDraftEnvelope<TForm> {
  if (isFreshStartEnvelope(local)) {
    return {
      form: structuredClone(local.form),
      meta: {
        currentStepIndex: readStepIndex(local.meta),
        ...(local.meta.wizardSessionId !== undefined
          ? { wizardSessionId: local.meta.wizardSessionId }
          : {}),
        freshStart: true,
      },
    };
  }

  const deletedRoots = readDeletedRoots(server.meta);
  const localData = (local.form as { data?: Record<string, unknown> }).data;
  const serverData = (server.form as { data?: Record<string, unknown> }).data;
  const localEssentiallyEmpty = isDraftEssentiallyEmpty(
    local.form as unknown as Record<string, unknown>
  );

  return {
    form: {
      ...local.form,
      data: mergeCanonicalFormData(localData, serverData, deletedRoots),
    } as TForm,
    meta: {
      currentStepIndex: (() => {
        if (local.meta.freshStart === true) {
          return 0;
        }
        const localStepIndex = readStepIndex(local.meta);
        if (localStepIndex > 0) {
          return localStepIndex;
        }
        if (localEssentiallyEmpty) {
          return 0;
        }
        return readStepIndex(server.meta);
      })(),
      wizardSessionId: local.meta.wizardSessionId ?? server.meta.wizardSessionId,
      ...(readSourceRowVersion(local.meta) !== undefined
        ? { sourceRowVersion: readSourceRowVersion(local.meta) }
        : readSourceRowVersion(server.meta) !== undefined
          ? { sourceRowVersion: readSourceRowVersion(server.meta) }
          : {}),
    },
  };
}
