"use server";

import { buildTourAuthHeaders, type CreateTourPayload, type TourRecordDto } from "@app-tour/workspace-sdk";

import { resolveBootstrapAppSession } from "@/tenant/tenant-kernel";

import { FetchTourClient } from "./fetch-tour-client";

export type CreateTourActionResult =
  | { readonly ok: true; readonly record: TourRecordDto }
  | { readonly ok: false; readonly status: number; readonly code: string; readonly message: string };

function apiBaseUrl(): string {
  const url = process.env.TOUR_OPS_API_URL?.trim();
  if (url === undefined || url.length === 0) {
    throw new Error("TOUR_OPS_API_URL_NOT_CONFIGURED");
  }
  return url.replace(/\/$/, "");
}

export async function createTourAction(payload: CreateTourPayload): Promise<CreateTourActionResult> {
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

  const client = new FetchTourClient(apiBaseUrl());
  try {
    const record = await client.createTour(payload, auth);
    return { ok: true, record };
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "status" in error &&
      "code" in error &&
      "message" in error
    ) {
      return {
        ok: false,
        status: Number((error as { status: number }).status),
        code: String((error as { code: string }).code),
        message: String((error as { message: string }).message),
      };
    }
    throw error;
  }
}
