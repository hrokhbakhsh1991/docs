/** Shared member offline-receipt status — safe for client + BFF (not a server-only module). */
export type MemberReceiptStatus = "none" | "pending" | "rejected" | "paid";

export function parseMemberReceiptStatus(value: unknown): MemberReceiptStatus {
  if (value === "pending" || value === "rejected" || value === "paid" || value === "none") {
    return value;
  }
  return "none";
}
