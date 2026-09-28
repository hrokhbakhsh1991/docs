import type { RegistrationLifecycleStatus } from "./registration-lifecycle-status";

type Input = {
  readonly registrationStatus: RegistrationLifecycleStatus;
  readonly paymentCollection?: "offline" | "free";
  readonly paymentStatus: string;
  readonly financialDisplayState?: string;
  readonly paymentDueAt?: string | null;
};

/**
 * A payment deadline is actionable only for an approved, money-bearing
 * registration that is not already settled. This remains fail-closed when an
 * older projection accidentally carries a stale paymentDueAt.
 */
export function shouldShowMemberPaymentDue(input: Input): boolean {
  if (input.registrationStatus !== "approved") return false;
  if (input.paymentCollection === "free") return false;
  if (input.financialDisplayState === "WAIVED") return false;
  if (input.paymentStatus.trim().toLowerCase() === "paid") return false;
  return typeof input.paymentDueAt === "string" && input.paymentDueAt.trim().length > 0;
}
