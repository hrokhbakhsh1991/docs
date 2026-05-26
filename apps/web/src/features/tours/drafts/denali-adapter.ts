import type { DraftEngineConfig } from "@repo/draft-engine";

import { fetchDraftSnapshot, patchDraftSnapshot } from "@/lib/draft-engine.client";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { normalizeDenaliWizardForm } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";

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
    conflictStrategy: "SERVER_WINS",
    debounceMs: 500,
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
  };
}

export function denaliDraftAdapter(
  workspaceId: string,
  getCurrentStepIndex: () => number,
): DraftEngineConfig<DenaliWizardDraftSnapshot> {
  return createDenaliDraftAdapter({ workspaceId, getCurrentStepIndex });
}
