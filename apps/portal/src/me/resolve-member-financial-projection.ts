import type { MemberRegistrationItem } from "./fetch-member-registrations.server";

export type MemberFinancialProjection = Pick<
  MemberRegistrationItem,
  "paymentStatus" | "paymentCollection" | "financialDisplayState" | "paymentDueAt"
>;

/** Resolve one canonical member-facing financial projection for List and Detail. */
export function resolveMemberFinancialProjection(
  input: Pick<
    MemberRegistrationItem,
    "paymentStatus" | "paymentCollection" | "financialDisplayState" | "paymentDueAt"
  > & { readonly status?: string }
): MemberFinancialProjection {
  const paymentStatus = input.paymentStatus.trim().toLowerCase();
  const isApproved = input.status === undefined || input.status === "approved";
  const isWaived =
    isApproved && (input.paymentCollection === "free" || input.financialDisplayState === "WAIVED");
  const isPaid = isApproved && paymentStatus === "paid";

  return {
    paymentStatus: input.paymentStatus,
    ...(isWaived
      ? { paymentCollection: "free" as const }
      : input.paymentCollection
        ? { paymentCollection: input.paymentCollection }
        : {}),
    ...(isWaived ? { financialDisplayState: "WAIVED" as const } : {}),
    paymentDueAt: isWaived || isPaid ? null : (input.paymentDueAt ?? null),
  };
}
