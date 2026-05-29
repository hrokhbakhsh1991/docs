"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchWorkspaceTourWizardTemplate } from "@/lib/settings-tour-wizard-template.client";
import { settingsTourWizardTemplateKeys } from "@/lib/query-keys";
import { useAuthBffQueryGateForTenant } from "./use-auth-bff-query-gate";
import { useWorkspaceQueryScope } from "./use-workspace-query-scope";

export function useTenantWizardTemplate() {
  const tenantId = useWorkspaceQueryScope();
  const { authBffQueryEnabled } = useAuthBffQueryGateForTenant(tenantId);
  return useQuery({
    queryKey: settingsTourWizardTemplateKeys.detail(tenantId ?? ""),
    queryFn: fetchWorkspaceTourWizardTemplate,
    enabled: authBffQueryEnabled,
    staleTime: 60_000,
    select: (envelope) => envelope.template,
  });
}
