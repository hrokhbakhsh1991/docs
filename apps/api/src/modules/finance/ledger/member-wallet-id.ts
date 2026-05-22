/** Ledger wallet id for a workspace member's personal balance within a tenant. */
export function memberWalletId(userId: string): string {
  const id = userId.trim();
  if (!id) {
    throw new Error("memberWalletId: userId is required");
  }
  return `member:${id}`;
}
