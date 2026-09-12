import {
  FORBIDDEN_WALLET_MODULE_DISABLED,
  WALLET_WORKSPACE_UNSUPPORTED,
} from "@app-tour/workspace-sdk/wallet";

import { isWalletModuleEnabled, parseEnabledModulesFromTheme } from "./wallet-module-enabled.ts";
import { resolveWalletTenantWorkspaceRow } from "./resolve-wallet-workspace-type-for-tenant.ts";
import { isWalletSupportedWorkspace } from "./workspace-wallet-bindings.generated.ts";

export { parseEnabledModulesFromTheme, isWalletModuleEnabled };

export async function assertWalletWorkspaceGate(tenantId: string): Promise<{
  readonly workspaceType: string;
  readonly theme: unknown;
}> {
  const row = await resolveWalletTenantWorkspaceRow(tenantId);
  if (row === null) {
    throw new Error(WALLET_WORKSPACE_UNSUPPORTED);
  }
  const workspaceType = row.workspaceType.trim().toLowerCase();
  if (workspaceType.length === 0 || !isWalletSupportedWorkspace(workspaceType)) {
    throw new Error(WALLET_WORKSPACE_UNSUPPORTED);
  }
  if (!isWalletModuleEnabled(row.theme, workspaceType)) {
    throw new Error(FORBIDDEN_WALLET_MODULE_DISABLED);
  }
  return row;
}
