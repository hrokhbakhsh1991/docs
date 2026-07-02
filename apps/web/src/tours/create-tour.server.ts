"use server";

import { headers } from "next/headers";

import type { CreateTourPayload, TourRecordDto } from "@app-tour/workspace-sdk";

import { readSessionTokenFromCookies } from "@/auth/read-session-token.server";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

import { parseTourApiErrorBody } from "./parse-tour-api-error-body";

export type CreateTourActionResult =
  | { readonly ok: true; readonly record: TourRecordDto }
  | {
      readonly ok: false;
      readonly status: number;
      readonly code: string;
      readonly message: string;
      readonly correlationId?: string;
    };

export async function createTourAction(payload: CreateTourPayload): Promise<CreateTourActionResult> {
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
  const response = await fetch(`${resolveTourOpsApiBaseUrl()}/tours`, {
    method: "POST",
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
      ...(parsed.correlationId !== undefined ? { correlationId: parsed.correlationId } : {}),
    };
  }

  return { ok: true, record: body as TourRecordDto };
}
