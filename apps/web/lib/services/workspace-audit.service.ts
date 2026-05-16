import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";
import { isTourOpsApiConfigured } from "../tour-ops-api-origin";

export function workspaceAuditUseLiveApi(): boolean {
  return isTourOpsApiConfigured();
}

export type TenantAuditEventRowDto = {
  id: string;
  occurredAt: string;
  actor: string;
  actorUserId: string | null;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  clientIp: string;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
};

export type ListTenantAuditEventsParams = {
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  actorContains?: string;
};

export type ListTenantAuditEventsResponseDto = {
  data: TenantAuditEventRowDto[];
  nextCursor: string | null;
};

export async function listTenantAuditEvents(
  tenantId: string,
  params?: ListTenantAuditEventsParams
): Promise<ListTenantAuditEventsResponseDto> {
  const qs = new URLSearchParams();
  if (params?.from?.trim()) qs.set("from", params.from.trim());
  if (params?.to?.trim()) qs.set("to", params.to.trim());
  if (params?.limit !== undefined) qs.set("limit", String(params.limit));
  if (params?.cursor?.trim()) qs.set("cursor", params.cursor.trim());
  if (params?.action?.trim()) qs.set("action", params.action.trim());
  if (params?.resourceType?.trim()) qs.set("resourceType", params.resourceType.trim());
  if (params?.resourceId?.trim()) qs.set("resourceId", params.resourceId.trim());
  if (params?.actorContains?.trim()) qs.set("actorContains", params.actorContains.trim());
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return bffBrowserClient.get<ListTenantAuditEventsResponseDto>(
    `${BFF.workspaceAuditEvents(tenantId)}${suffix}`,
    { skip403Redirect: true },
  );
}

export type ExportTenantAuditFormat = "csv" | "ndjson" | "json";

export async function downloadTenantAuditExportBlob(
  tenantId: string,
  opts: {
    from?: string;
    to?: string;
    format: ExportTenantAuditFormat;
    limit?: number;
  }
): Promise<Blob> {
  const qs = new URLSearchParams();
  qs.set("format", opts.format);
  if (opts.from?.trim()) qs.set("from", opts.from.trim());
  if (opts.to?.trim()) qs.set("to", opts.to.trim());
  if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
  return bffBrowserClient.getBlob(`${BFF.workspaceAuditEventsExport(tenantId)}?${qs.toString()}`, {
    skip403Redirect: true,
  });
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
}
