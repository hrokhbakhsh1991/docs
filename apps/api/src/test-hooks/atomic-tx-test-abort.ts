/**
 * Phase 4B H0.3 — P5_ATOMIC_TX_TEST_ABORT must never fire outside the test runtime.
 */
export function isAtomicTxTestAbortEnabled(): boolean {
  return process.env.NODE_ENV === "test";
}

/** True when the named abort hook is armed and test abort is allowed. */
export function shouldAbortAtomicTx(hook: string): boolean {
  return isAtomicTxTestAbortEnabled() && process.env.P5_ATOMIC_TX_TEST_ABORT === hook;
}
