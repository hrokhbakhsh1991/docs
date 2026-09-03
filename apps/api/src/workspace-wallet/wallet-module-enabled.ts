/**
 * Theme module enablement helpers shared by wallet workspace gate.
 * Default-when-unset comes from generated workspace wallet bindings
 * (manifest `workspaceWallet.defaultModuleEnabledWhenUnset`) — not hardcoded workspace ids.
 */

import {
  isWalletModuleEnabled as isWalletModuleEnabledCore,
  parseEnabledModulesFromTheme,
  type WalletModuleEnablementBindings,
} from "@app-tour/workspace-sdk/wallet";

import {
  isWalletDefaultEnabledWhenModulesUnset,
  isWalletSupportedWorkspace,
} from "./workspace-wallet-bindings.generated.ts";

const WALLET_MODULE_BINDINGS: WalletModuleEnablementBindings = {
  isSupportedWorkspace: isWalletSupportedWorkspace,
  isDefaultEnabledWhenModulesUnset: isWalletDefaultEnabledWhenModulesUnset,
};

export { parseEnabledModulesFromTheme };

export function isWalletModuleEnabled(theme: unknown, workspaceType: string): boolean {
  return isWalletModuleEnabledCore(theme, workspaceType, WALLET_MODULE_BINDINGS);
}
