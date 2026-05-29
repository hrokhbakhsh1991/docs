import type { DraftEngineConfig, DraftSetDataOptions } from "@repo/draft-engine";
import { DRAFT_SNAPSHOT_DEFAULT_SCHEMA_VERSION } from "@repo/shared-contracts";
import {
  denaliDraftOrchestrator,
  DENALI_REGISTRY_LAYOUT_VERSION,
} from "@repo/denali-domain";
import { deleteDraftSnapshot, fetchDraftSnapshot, patchDraftSnapshot } from "@/lib/draft-engine.client";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { normalizeDenaliWizardForm } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";

import { sanitizeDenaliWizardDraftSnapshot } from "./sanitizeDenaliWizardDraftSnapshot";
import type { DenaliWizardDraftSnapshot } from "./denali-wizard-draft.types";

export type { DenaliWizardDraftSnapshot } from "./denali-wizard-draft.types";
export type { DraftSetDataOptions };

/**
 * Server hydration (initialize, applyDraft, 409 merge-on-conflict) is quiet inside
 * {@link DraftEngine}: re-fetch + `merge(local, server)` + `setDraftData(..., { source: 'remote', version })`
 * without scheduling a PATCH. User edits must call `setDraftData(..., { source: 'user' })`.
 */
export const DENALI_CREATE_DRAFT_KEY = "denali-create";

function readStringPath(record: Record<string, unknown>, path: readonly string[]): string {
  let node: unknown = record;
  for (const segment of path) {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return "";
    }
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === "string" ? node.trim() : "";
}

function hasMeaningfulDenaliFormData(form: unknown): boolean {
  if (!form || typeof form !== "object" || Array.isArray(form)) {
    return false;
  }
  const record = form as Record<string, unknown>;
  const keyPaths: ReadonlyArray<readonly string[]> = [
    ["basicInfo", "title"],
    ["basicInfo", "tourType"],
    ["basicInfo", "destinationId"],
    ["timing", "startDate"],
    ["timing", "endDate"],
  ];
  return keyPaths.some((path) => readStringPath(record, path).length > 0);
}

export function isMeaningfulDenaliDraftSnapshot(
  value: DenaliWizardDraftSnapshot | null | undefined,
): boolean {
  if (!value) {
    return false;
  }
  return value.currentStepIndex > 0 || hasMeaningfulDenaliFormData(value.form);
}

function isDenaliWizardDraftSnapshot(value: unknown): value is DenaliWizardDraftSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as { form?: unknown; currentStepIndex?: unknown };
  return record.form != null && typeof record.currentStepIndex === "number";
}

function snapshotFromOrchestrator(
  form: DenaliCreateTourWizardForm,
  currentStepIndex: number,
  railLayoutVersion?: number,
  registryLayoutVersion?: number,
): DenaliWizardDraftSnapshot {
  const prepared = denaliDraftOrchestrator.prepareDraftForSync(form, {
    currentStepIndex,
    registryLayoutVersion,
  });
  return sanitizeDenaliWizardDraftSnapshot({
    form: prepared.form,
    currentStepIndex: prepared.currentStepIndex,
    railLayoutVersion: railLayoutVersion ?? prepared.railLayoutVersion,
    registryLayoutVersion: registryLayoutVersion ?? prepared.registryLayoutVersion,
  });
}

export function createDenaliDraftAdapter(input: {
  workspaceId: string;
  getCurrentStepIndex: () => number;
}): DraftEngineConfig<DenaliWizardDraftSnapshot> {
  const workspaceId = input.workspaceId.trim();

  return {
    id: `${DENALI_CREATE_DRAFT_KEY}:${workspaceId}`,
    autoApply: false,
    conflictStrategy: "REFETCH_REAPPLY",
    debounceMs: 500,
    merge: (local, server) =>
      sanitizeDenaliWizardDraftSnapshot({
        currentStepIndex: local.currentStepIndex,
        railLayoutVersion: Math.max(
          local.railLayoutVersion ?? 1,
          server.railLayoutVersion ?? 1,
        ),
        registryLayoutVersion: Math.max(
          local.registryLayoutVersion ?? DENALI_REGISTRY_LAYOUT_VERSION,
          server.registryLayoutVersion ?? DENALI_REGISTRY_LAYOUT_VERSION,
        ),
        form: normalizeDenaliWizardForm({
          ...server.form,
          ...local.form,
        } as DenaliCreateTourWizardForm),
      }),
    onFetch: async () => {
      if (!workspaceId) {
        return null;
      }
      const remote = await fetchDraftSnapshot<DenaliWizardDraftSnapshot>(
        workspaceId,
        DENALI_CREATE_DRAFT_KEY,
      );
      if (!remote || !isDenaliWizardDraftSnapshot(remote.data)) {
        return null;
      }
      const hydrated = denaliDraftOrchestrator.hydrateDraftFromSync({
        form: normalizeDenaliWizardForm(remote.data.form),
        currentStepIndex: remote.data.currentStepIndex,
        railLayoutVersion: remote.data.railLayoutVersion,
        registryLayoutVersion: remote.data.registryLayoutVersion,
      });
      return {
        data: sanitizeDenaliWizardDraftSnapshot({
          form: hydrated.snapshot.form,
          currentStepIndex: hydrated.snapshot.currentStepIndex,
          railLayoutVersion: hydrated.snapshot.railLayoutVersion,
          registryLayoutVersion: hydrated.snapshot.registryLayoutVersion,
        }),
        version: remote.version,
        schemaVersion: remote.schemaVersion,
        lastModified: remote.lastModified,
      };
    },
    onPush: async (payload) => {
      if (!workspaceId) {
        throw new Error("Cannot push Denali draft without workspace scope");
      }
      const snapshot = snapshotFromOrchestrator(
        normalizeDenaliWizardForm(payload.data.form),
        input.getCurrentStepIndex(),
        payload.data.railLayoutVersion,
        payload.data.registryLayoutVersion,
      );
      const result = await patchDraftSnapshot<DenaliWizardDraftSnapshot>(
        workspaceId,
        DENALI_CREATE_DRAFT_KEY,
        {
          data: snapshot,
          version: payload.version,
          schemaVersion: payload.schemaVersion ?? DRAFT_SNAPSHOT_DEFAULT_SCHEMA_VERSION,
          lastModified: payload.lastModified,
        },
      );
      return {
        data: sanitizeDenaliWizardDraftSnapshot({
          form: normalizeDenaliWizardForm(result.data.form),
          currentStepIndex: result.data.currentStepIndex,
          railLayoutVersion: result.data.railLayoutVersion,
          registryLayoutVersion: result.data.registryLayoutVersion,
        }),
        version: result.version,
        schemaVersion: result.schemaVersion,
        lastModified: result.lastModified,
      };
    },
    onDelete: async () => {
      if (!workspaceId) {
        return;
      }
      await deleteDraftSnapshot(workspaceId, DENALI_CREATE_DRAFT_KEY);
    },
  };
}

export function denaliDraftAdapter(
  workspaceId: string,
  getCurrentStepIndex: () => number,
): DraftEngineConfig<DenaliWizardDraftSnapshot> {
  return createDenaliDraftAdapter({ workspaceId, getCurrentStepIndex });
}
