import type { DraftEngineConfig, DraftSetDataOptions } from "@repo/draft-engine";
import { deleteDraftSnapshot, fetchDraftSnapshot, patchDraftSnapshot } from "@/lib/draft-engine.client";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { normalizeDenaliWizardForm } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";

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
};

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
    merge: (local, server) => ({
      currentStepIndex: local.currentStepIndex,
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
        data: {
          form: normalizeDenaliWizardForm(remote.data.form),
          currentStepIndex: remote.data.currentStepIndex,
        },
        version: remote.version,
        lastModified: remote.lastModified,
      };
    },
    onPush: async (payload) => {
      if (!workspaceId) {
        throw new Error("Cannot push Denali draft without workspace scope");
      }
      const snapshot: DenaliWizardDraftSnapshot = {
        form: normalizeDenaliWizardForm(payload.data.form),
        currentStepIndex: input.getCurrentStepIndex(),
      };
      const result = await patchDraftSnapshot<DenaliWizardDraftSnapshot>(
        workspaceId,
        DENALI_CREATE_DRAFT_KEY,
        {
          data: snapshot,
          version: payload.version,
          lastModified: payload.lastModified,
        },
      );
      return {
        data: {
          form: normalizeDenaliWizardForm(result.data.form),
          currentStepIndex: result.data.currentStepIndex,
        },
        version: result.version,
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
