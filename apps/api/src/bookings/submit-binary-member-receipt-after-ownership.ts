/**
 * MR-P0-010 — object-storage put must not run until ownership succeeds.
 * Keeps binary receipt upload free of orphan proofs / cross-booking probing DoS.
 */
export async function submitBinaryMemberReceiptAfterOwnership<
  TStored extends { storageKey: string },
  TResult,
>(input: {
  readonly assertOwns: () => Promise<void>;
  readonly putProof: () => Promise<TStored>;
  readonly submit: (fileKey: string) => Promise<TResult>;
  readonly cleanup?: (fileKey: string) => Promise<void>;
}): Promise<TResult> {
  await input.assertOwns();
  const stored = await input.putProof();
  try {
    return await input.submit(stored.storageKey);
  } catch (error) {
    await input.cleanup?.(stored.storageKey).catch(() => undefined);
    throw error;
  }
}
