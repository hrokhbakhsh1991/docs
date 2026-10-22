import type { MemberRegistrationItem } from "./fetch-member-registrations.server";

export type MemberFinancialProjection = Pick<
  MemberRegistrationItem,
  "paymentStatus" | "paymentCollection" | "financialDisplayState" | "paymentDueAt"
>;

function hasPositiveDue(value: string | undefined): boolean {
  if (value === undefined) return false;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return false;
  try {
    return BigInt(digits) > BigInt(0);
  } catch {
    return false;
  }
}

/** Resolve one canonical member-facing financial projection for List and Detail. */
export function resolveMemberFinancialProjection(
  input: Pick<
    MemberRegistrationItem,
    | "paymentStatus"
    | "paymentCollection"
    | "financialDisplayState"
    | "paymentDueAt"
    | "dueTotalMinor"
  > & { readonly status?: string }
): MemberFinancialProjection {
  const paymentStatus = input.paymentStatus.trim().toLowerCase();
  const isApproved = input.status === undefined || input.status === "approved";
  const hasDue = hasPositiveDue(input.dueTotalMinor);
  const isWaived =
    isApproved &&
    !hasDue &&
    (input.paymentCollection === "free" || input.financialDisplayState === "WAIVED");
  const isPaid = isApproved && paymentStatus === "paid";

  return {
    paymentStatus: input.paymentStatus,
    ...(hasDue && input.paymentCollection === "free"
      ? { paymentCollection: "offline" as const }
      : isWaived
        ? { paymentCollection: "free" as const }
        : input.paymentCollection
          ? { paymentCollection: input.paymentCollection }
          : {}),
    ...(isWaived ? { financialDisplayState: "WAIVED" as const } : {}),
    paymentDueAt: isWaived || isPaid ? null : (input.paymentDueAt ?? null),
  };
}
