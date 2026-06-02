"use client";

import { useQuery } from "@tanstack/react-query";

import {
  instantiateWorkspaceTourWizardTemplate,
  type TourWizardTemplateInstantiateResponse,
} from "@/lib/settings-tour-wizard-template.client";
import { settingsTourWizardTemplateKeys } from "@/lib/query-keys";
import { useAuthBffQueryGateForTenant } from "@/hooks/use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";

export type { TourWizardTemplateInstantiateResponse };

/**
 * Headless factory bridge — loads {@link DenaliTemplateOrchestratorFactory} output for the
 * persisted workspace template via `POST /api/v2/settings/tour-wizard-template/instantiate`.
 * Does not seed Postgres (`seedDraft` omitted); draft precedence remains client-side.
 */
export function useInstantiateWorkspaceTemplate(enabled = true) {
  const tenantId = useWorkspaceQueryScope();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);
  const queryEnabled = enabled && authBffQueryEnabled && Boolean(tenantId);

  return useQuery({
    queryKey: settingsTourWizardTemplateKeys.instantiate(tenantId ?? ""),
    queryFn: () => instantiateWorkspaceTourWizardTemplate(),
    enabled: queryEnabled,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}
