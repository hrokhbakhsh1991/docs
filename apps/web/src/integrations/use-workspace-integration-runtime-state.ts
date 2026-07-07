"use client";

import { useEffect, useState } from "react";

import { fetchWorkspaceIntegrations } from "@/integrations/integrations-client";
import { hasActiveTelegramDeliverySource } from "@/integrations/integrations-settings-logic";

export type WorkspaceIntegrationRuntimeState = {
  readonly telegramIntegrationActive: boolean;
  readonly loading: boolean;
};

const INACTIVE_RUNTIME_STATE: WorkspaceIntegrationRuntimeState = {
  telegramIntegrationActive: false,
  loading: false,
};

export function useWorkspaceIntegrationRuntimeState(
  workspaceId: string
): WorkspaceIntegrationRuntimeState {
  const [state, setState] = useState<WorkspaceIntegrationRuntimeState>({
    telegramIntegrationActive: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true }));

    void fetchWorkspaceIntegrations(workspaceId)
      .then((list) => {
        if (!cancelled) {
          setState({
            telegramIntegrationActive: hasActiveTelegramDeliverySource(list),
            loading: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState(INACTIVE_RUNTIME_STATE);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return state;
}
