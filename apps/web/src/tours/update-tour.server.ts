"use server";

import { buildTourAuthHeaders, type UpdateTourPayload } from "@app-tour/workspace-sdk";

import { resolveBootstrapAppSession } from "@/tenant/tenant-kernel";

export type UpdateTourActionResult =
  | { readonly ok: true; readonly rowVersion: number }
  | { readonly ok: false; readonly status: number; readonly code: string; readonly message: string };

function apiBaseUrl(): string {
  const url = process.env.TOUR_OPS_API_URL?.trim();
  if (url === undefined || url.length === 0) {
    throw new Error("TOUR_OPS_API_URL_NOT_CONFIGURED");
  }
  return url.replace(/\/$/, "");
}

export async function updateTourAction(
  tourId: string,
  payload: UpdateTourPayload
): Promise<UpdateTourActionResult> {
  const { context } = resolveBootstrapAppSession();
  if (context.workspaceId === undefined) {
    throw new Error("WEB_SESSION_MISSING_WORKSPACE_ID");
  }

  const auth = buildTourAuthHeaders({
    tenantId: context.tenantId,
    userId: context.userId,
    role: context.role,
    status: context.status,
    workspaceId: context.workspaceId,
  });

  const headers: Record<string, string> = {
    ...auth,
    "content-type": "application/json",
  };

  const response = await fetch(`${apiBaseUrl()}/tours/${encodeURIComponent(tourId)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code =
      body !== null &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error?: unknown }).error === "string"
        ? String((body as { error: string }).error)
        : "unknown_error";
    return {
      ok: false,
      status: response.status,
      code,
      message: code,
    };
  }

  const rowVersion =
    body !== null && typeof body === "object" && "rowVersion" in body
      ? Number((body as { rowVersion: unknown }).rowVersion)
      : payload.rowVersion;

  return { ok: true, rowVersion };
}
