"use server";

import { headers } from "next/headers";

import type { UpdateTourPayload } from "@app-tour/workspace-sdk";

import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromCookies } from "@/auth/read-session-token.server";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

import { parseTourApiErrorBody } from "./parse-tour-api-error-body";

export type UpdateTourActionResult =
  | { readonly ok: true; readonly rowVersion: number }
  | { readonly ok: false; readonly status: number; readonly code: string; readonly message: string };

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
  const response = await operatorApiFetch(`${resolveTourOpsApiBaseUrl()}/tours/${encodeURIComponent(tourId)}`, {
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
    const parsed = parseTourApiErrorBody(body);
    return {
      ok: false,
      status: response.status,
      code: parsed.code,
      message: parsed.message,
    };
  }

  const rowVersion =
    body !== null && typeof body === "object" && "rowVersion" in body
      ? Number((body as { rowVersion: unknown }).rowVersion)
      : payload.rowVersion;

  return { ok: true, rowVersion };
}
