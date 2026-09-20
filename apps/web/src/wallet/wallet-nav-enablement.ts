/**
 * WALLET-P3B — wallet ops hub availability from capabilities.walletNav + module enablement.
 *
 * Sync helpers read the warm cache — callers must `ensureWalletNavSupported` first
 * (operator layout, wallet page).
 */
import {
  ensureWalletNavSupported,
  isWalletNavPlugin,
} from "@/wallet/wallet-nav-registry";

export { ensureWalletNavSupported, isWalletNavPlugin };

export function shouldShowWalletNav(pluginId: string): boolean {
  return isWalletNavPlugin(pluginId);
}

export function isWalletRouteAllowed(pluginId: string): boolean {
  return shouldShowWalletNav(pluginId);
}

/** Ensure then gate — preferred for async server routes. */
export async function ensureWalletRouteAllowed(
  pluginId: string,
  theme: unknown = null,
): Promise<boolean> {
  return ensureWalletNavSupported(pluginId, theme);
}
