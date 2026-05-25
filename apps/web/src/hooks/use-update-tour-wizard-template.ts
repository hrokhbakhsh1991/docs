"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  updateWorkspaceTourWizardTemplate,
  type UpdateWorkspaceTourWizardTemplatePayload,
} from "@/lib/settings-tour-wizard-template.client";
import { settingsTourWizardTemplateKeys } from "@/lib/query-keys";

import { useWorkspaceQueryScope } from "./use-workspace-query-scope";

export function useUpdateTourWizardTemplate() {
  const tenantId = useWorkspaceQueryScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateWorkspaceTourWizardTemplatePayload) =>
      updateWorkspaceTourWizardTemplate(payload),
    onSuccess: async () => {
      if (tenantId) {
        await queryClient.invalidateQueries({
          queryKey: settingsTourWizardTemplateKeys.detail(tenantId),
        });
      }
    },
  });
}
