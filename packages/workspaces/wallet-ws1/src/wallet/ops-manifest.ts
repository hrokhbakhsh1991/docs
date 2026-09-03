/**
 * Wallet-ws1 ops manifest placeholder — UI metadata contract only (no runtime ops).
 */
export type WalletWs1OpsManifestPlaceholder = {
  readonly id: string;
  readonly version: number;
};

export const DEFAULT_WALLET_OPS_MANIFEST = Object.freeze({
  id: "wallet_ws1_contract_placeholder",
  version: 1,
}) satisfies WalletWs1OpsManifestPlaceholder;

export function resolveWalletOpsManifestFromTheme(
  _theme: unknown = null,
): WalletWs1OpsManifestPlaceholder {
  return DEFAULT_WALLET_OPS_MANIFEST;
}
