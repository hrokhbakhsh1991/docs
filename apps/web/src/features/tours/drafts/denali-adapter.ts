import type { DraftEngineConfig, DraftSetDataOptions } from "@repo/draft-engine";
import { DRAFT_SNAPSHOT_DEFAULT_SCHEMA_VERSION } from "@repo/shared-contracts";
import { deleteDraftSnapshot, fetchDraftSnapshot, patchDraftSnapshot } from "@/lib/draft-engine.client";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { normalizeDenaliWizardForm } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";

import {
  DENALI_WIZARD_RAIL_LAYOUT_VERSION,
  sanitizeDenaliWizardDraftSnapshot,
} from "./sanitizeDenaliWizardDraftSnapshot";

export type { DraftSetDataOptions };

/**
 * Server hydration (initialize, applyDraft, 409 merge-on-conflict) is quiet inside
 * {@link DraftEngine}: re-fetch + `merge(local, server)` + `setDraftData(..., { source: 'remote', version })`
 * without scheduling a PATCH. User edits must call `setDraftData(..., { source: 'user' })`.
 */
export const DENALI_CREATE_DRAFT_KEY = "denali-create";

export type DenaliWizardDraftSnapshot = {
  form: DenaliCreateTourWizardForm;
  currentStepIndex: number;
  /** Wizard rail layout generation; {@link DENALI_WIZARD_RAIL_LAYOUT_VERSION} after phase 3 relocation. */
  railLayoutVersion?: number;
};

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
      return {
        data: sanitizeDenaliWizardDraftSnapshot({
          form: normalizeDenaliWizardForm(remote.data.form),
          currentStepIndex: remote.data.currentStepIndex,
          railLayoutVersion: remote.data.railLayoutVersion,
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
      const snapshot: DenaliWizardDraftSnapshot = sanitizeDenaliWizardDraftSnapshot({
        form: normalizeDenaliWizardForm(payload.data.form),
        currentStepIndex: input.getCurrentStepIndex(),
        railLayoutVersion: payload.data.railLayoutVersion ?? DENALI_WIZARD_RAIL_LAYOUT_VERSION,
      });
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
