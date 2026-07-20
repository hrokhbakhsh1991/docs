/**
 * Phase 4B H0.3 — P5_ATOMIC_TX_TEST_ABORT must never fire outside the test runtime,
 * and never under production-grade integrity (hostile audit P2).
 */
import { requiresProductionGradeIntegrity } from "../server/runtime-profile";

export function isAtomicTxTestAbortEnabled(): boolean {
  return process.env.NODE_ENV === "test" && !requiresProductionGradeIntegrity();
}

/** True when the named abort hook is armed and test abort is allowed. */
export function shouldAbortAtomicTx(hook: string): boolean {
  return isAtomicTxTestAbortEnabled() && process.env.P5_ATOMIC_TX_TEST_ABORT === hook;
}
