/**
 * Denali ops manifest placeholder — UI metadata contract only (no runtime ops).
 */
export type DenaliWalletOpsManifestPlaceholder = {
  readonly id: string;
  readonly version: number;
};

export const DEFAULT_WALLET_OPS_MANIFEST = Object.freeze({
  id: "denali_wallet_contract_placeholder",
  version: 1,
}) satisfies DenaliWalletOpsManifestPlaceholder;

export function resolveWalletOpsManifestFromTheme(
  _theme: unknown = null,
): DenaliWalletOpsManifestPlaceholder {
  return DEFAULT_WALLET_OPS_MANIFEST;
}
