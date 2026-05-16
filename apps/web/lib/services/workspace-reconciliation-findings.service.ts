import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";
import { isTourOpsApiConfigured } from "../tour-ops-api-origin";

export function workspaceReconciliationUseLiveApi(): boolean {
  return isTourOpsApiConfigured();
}

export type ReconciliationFindingStatusDto =
  | "open"
  | "acknowledged"
  | "resolved"
  | "dismissed";

export type ReconciliationFindingRowDto = {
  id: string;
  tenantId: string;
  reconciliationJobId: string;
  findingUuid: string;
  bookingId: string;
  kind: string;
  severity: string;
  message: string;
  data: Record<string, unknown>;
  triadMismatch: Record<string, unknown> | null;
  status: ReconciliationFindingStatusDto;
  resolutionNote: string | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListReconciliationFindingsParams = {
  status?: ReconciliationFindingStatusDto;
  limit?: number;
  cursor?: string;
};

export type ListReconciliationFindingsResponseDto = {
  data: ReconciliationFindingRowDto[];
  nextCursor: string | null;
};

export async function listReconciliationFindings(
  tenantId: string,
  params?: ListReconciliationFindingsParams
): Promise<ListReconciliationFindingsResponseDto> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.limit !== undefined) qs.set("limit", String(params.limit));
  if (params?.cursor?.trim()) qs.set("cursor", params.cursor.trim());
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return bffBrowserClient.get<ListReconciliationFindingsResponseDto>(
    `${BFF.workspaceReconciliationFindings(tenantId)}${suffix}`,
    { skip403Redirect: true },
  );
}

export async function acknowledgeReconciliationFinding(
  tenantId: string,
  findingId: string,
  body: { note?: string }
): Promise<ReconciliationFindingRowDto> {
  return bffBrowserClient.post<ReconciliationFindingRowDto>(
    BFF.reconciliationFindingAction(tenantId, findingId, "acknowledge"),
    body,
    { skip403Redirect: true },
  );
}

export type ReconciliationLedgerAdjustmentFlow = "credit_booking_wallet" | "debit_booking_wallet";

export async function applyReconciliationLedgerAdjustment(
  tenantId: string,
  findingId: string,
  body: {
    idempotencyKey: string;
    amountMinor: string;
    flow: ReconciliationLedgerAdjustmentFlow;
    currencyOverride?: string;
    note?: string;
  }
): Promise<ReconciliationFindingRowDto> {
  return bffBrowserClient.post<ReconciliationFindingRowDto>(
    BFF.reconciliationFindingAction(tenantId, findingId, "apply-ledger-adjustment"),
    body,
    { skip403Redirect: true },
  );
}
