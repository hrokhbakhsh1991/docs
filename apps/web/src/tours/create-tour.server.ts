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

function isDenaliCanonicalCreatePayload(payload: CreateTourPayload): boolean {
  if (Array.isArray(payload.roots) && payload.roots.length > 0) {
    return payload.roots.some(
      (root) =>
        root.startsWith("denali_") ||
        root === "program" ||
        root === "transport" ||
        root === "participants" ||
        root === "tripDetails"
    );
  }
  const data = payload.data;
  if (data == null) {
    return false;
  }
  const category = data.category;
  return typeof category === "string" && category.trim().length > 0;
}

/**
 * Starter smoke shim — maps legacy flat Denali title into `basics.title` when roots are absent.
 * Full Denali canonical payloads (schemaVersion + roots + data) pass through unchanged.
 */
function normalizeTourCreatePayload(
  payload: CreateTourPayload,
  pluginId: string
): CreateTourPayload {
  if (pluginId === "denali" && isDenaliCanonicalCreatePayload(payload)) {
    return payload;
  }
  if (pluginId !== "denali") {
    return payload;
  }
  const data = payload.data as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (title.length === 0) {
    return payload;
  }
  const basics = data.basics;
  const existingTitle =
    basics !== null &&
    typeof basics === "object" &&
    "title" in basics &&
    typeof (basics as { title?: unknown }).title === "string"
      ? (basics as { title: string }).title.trim()
      : "";
  if (existingTitle.length > 0) {
    return payload;
  }
  const details = data.details;
  const existingSummary =
    details !== null &&
    typeof details === "object" &&
    "summary" in details &&
    typeof (details as { summary?: unknown }).summary === "string"
      ? (details as { summary: string }).summary.trim()
      : "";
  return {
    data: {
      basics: { title },
      details: { summary: existingSummary.length > 0 ? existingSummary : title },
    },
  };
}

export async function createTourAction(payload: CreateTourPayload): Promise<CreateTourActionResult> {
  const { context, session } = resolveBootstrapAppSession();
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
  const normalizedPayload = normalizeTourCreatePayload(payload, session.pluginId);
  try {
    const record = await client.createTour(normalizedPayload, auth);
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
