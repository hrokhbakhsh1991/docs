import {
  FORBIDDEN_TICKETING_MODULE_DISABLED,
  TICKETING_WORKSPACE_UNSUPPORTED,
  getWorkspaceTicketingCapabilities,
  type WorkspaceTicketingCapabilities,
} from "@app-tour/workspace-sdk/ticketing";

import { assertTicketingWorkspaceGate } from "../assert-ticketing-access.ts";

export type TicketingCapabilityPort = {
  readonly assertEnabled: (tenantId: string) => Promise<{
    readonly workspaceType: string;
    readonly capabilities: WorkspaceTicketingCapabilities;
  }>;
  readonly getCapabilitiesForTenant: (
    tenantId: string,
  ) => Promise<WorkspaceTicketingCapabilities | null>;
};

export class HostTicketingCapabilityAdapter implements TicketingCapabilityPort {
  async assertEnabled(tenantId: string): Promise<{
    readonly workspaceType: string;
    readonly capabilities: WorkspaceTicketingCapabilities;
  }> {
    const row = await assertTicketingWorkspaceGate(tenantId);
    const capabilities = getWorkspaceTicketingCapabilities(row.workspaceType);
    if (capabilities === null) {
      throw new Error(TICKETING_WORKSPACE_UNSUPPORTED);
    }
    return { workspaceType: row.workspaceType, capabilities };
  }

  async getCapabilitiesForTenant(
    tenantId: string,
  ): Promise<WorkspaceTicketingCapabilities | null> {
    try {
      const { workspaceType, capabilities } = await this.assertEnabled(tenantId);
      void workspaceType;
      return capabilities;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === TICKETING_WORKSPACE_UNSUPPORTED ||
          error.message === FORBIDDEN_TICKETING_MODULE_DISABLED)
      ) {
        return null;
      }
      throw error;
    }
  }
}
