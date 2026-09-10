export {
  FORBIDDEN_WALLET_MODULE_DISABLED,
  WALLET_MODULE_THEME_KEY,
  WALLET_WORKSPACE_UNSUPPORTED,
} from "./wallet-error-codes.js";
export {
  isWalletModuleEnabled,
  parseEnabledModulesFromTheme,
  type WalletModuleEnablementBindings,
} from "./wallet-module-enabled.js";
export type {
  WalletCapabilityPort,
  WalletWorkspaceGateResult,
} from "./ports/wallet-capability.port.js";
export {
  getWorkspaceWalletCapabilities,
  listWalletCapableWorkspaceTypes,
  walletWorkspaceHasCapability,
  type WorkspaceWalletCapabilities,
} from "../catalog/workspace-wallet-capabilities.generated.js";
