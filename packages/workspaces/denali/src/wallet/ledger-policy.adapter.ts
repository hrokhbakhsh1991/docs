/**
 * WALLET-P0-001 §9.2 — manifest-bound ledger policy binding only.
 * Wallet V1 runtime does not invoke workspace ledger policy adapters (no Finance coupling).
 * @see docs/architecture/wallet-module-phase-0-contract.mdoc §9.2
 */
export class DenaliWalletLedgerPolicyAdapter {
  readonly kind = "denali-wallet-ledger-policy" as const;
}
