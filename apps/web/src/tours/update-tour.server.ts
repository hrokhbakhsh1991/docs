"use server";

import { headers } from "next/headers";

import type { UpdateTourPayload } from "@app-tour/workspace-sdk";

import { readSessionTokenFromCookies } from "@/auth/read-session-token.server";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

export type UpdateTourActionResult =
  | { readonly ok: true; readonly rowVersion: number }
  | { readonly ok: false; readonly status: number; readonly code: string; readonly message: string };

function parseApiErrorCode(body: unknown): string {
  if (body === null || typeof body !== "object") {
    return "unknown_error";
  }
  const record = body as Record<string, unknown>;
  if (typeof record.code === "string" && record.code.trim().length > 0) {
    return record.code.trim();
  }
  if (typeof record.error === "string" && record.error.trim().length > 0) {
    return record.error.trim();
  }
  if (
    record.error !== null &&
    typeof record.error === "object" &&
    "code" in record.error &&
    typeof (record.error as { code?: unknown }).code === "string"
  ) {
    return String((record.error as { code: string }).code);
  }
  return "unknown_error";
}

export async function updateTourAction(
  tourId: string,
  payload: UpdateTourPayload
): Promise<UpdateTourActionResult> {
  const sessionToken = await readSessionTokenFromCookies();
  if (sessionToken === null) {
    return {
      ok: false,
      status: 401,
      code: "AUTH_UNAUTHENTICATED",
      message: "AUTH_UNAUTHENTICATED",
    };
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  const response = await fetch(`${resolveTourOpsApiBaseUrl()}/tours/${encodeURIComponent(tourId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      host: host.split(":")[0] ?? "localhost",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = parseApiErrorCode(body);
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
