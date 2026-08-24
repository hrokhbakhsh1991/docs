/**
 * In-memory member cancellation requests — DP-4 seam for DP-6 refund orchestration.
 */
import { randomUUID } from "node:crypto";

export type MemberCancellationRequestStatus = "pending" | "approved" | "rejected";

export type MemberCancellationRequestRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly bookingId: string;
  readonly requestedByUserId: string;
  readonly status: MemberCancellationRequestStatus;
  readonly requestedAt: string;
};

const requests = new Map<string, MemberCancellationRequestRecord>();

export function resetMemberCancellationRequestsForTests(): void {
  requests.clear();
}

export function createMemberCancellationRequest(input: {
  readonly tenantId: string;
  readonly bookingId: string;
  readonly requestedByUserId: string;
}): MemberCancellationRequestRecord {
  const existing = [...requests.values()].find(
    (row) =>
      row.tenantId === input.tenantId &&
      row.bookingId === input.bookingId &&
      row.status === "pending"
  );
  if (existing !== undefined) {
    return existing;
  }
  const row: MemberCancellationRequestRecord = {
    id: randomUUID(),
    tenantId: input.tenantId,
    bookingId: input.bookingId,
    requestedByUserId: input.requestedByUserId,
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
  requests.set(row.id, row);
  return row;
}

export function findPendingMemberCancellationRequest(
  tenantId: string,
  bookingId: string
): MemberCancellationRequestRecord | null {
  for (const row of requests.values()) {
    if (
      row.tenantId === tenantId &&
      row.bookingId === bookingId &&
      row.status === "pending"
    ) {
      return row;
    }
  }
  return null;
}
