import type { TourDetailDto } from "@/lib/services/tours.service";
import { ApiError, type ApiRequestOptions } from "@/lib/api-client";
import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import type { CreateRegistrationPayload } from "@/lib/services/registrations.service";
import { normalizeRegistrationPayload, type PublicRegisterOutcome } from "@/lib/services/registrations.service";
import { coercePaymentIntentResponse } from "@/lib/services/payments.service";

import type { PublicCatalogApiStatus } from "@/features/public-site/config/resolve-public-site-config";

/** Guest-safe catalog row — no cost_context, internal notes, or staff-only fields. */
export type PublicTour = {
  readonly id: string;
  readonly title: string;
  readonly acceptedCount: number;
  readonly totalCapacity: number;
  readonly lifecycleStatus: "OPEN";
  readonly priceDisplay: string;
};

export type PublicCatalogResult = {
  tours: PublicTour[];
  total: number;
  page: number;
  limit: number;
};

type PublicCatalogBffResponse = {
  items?: unknown[];
  total?: number;
  page?: number;
  limit?: number;
  accessLevel?: string;
};

function pickStr(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) {
      return v.trim();
    }
  }
  return undefined;
}

function pickNum(o: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const v = o[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      return v;
    }
  }
  return undefined;
}

/** Derives display price once at map time; raw cost_context is never exposed on {@link PublicTour}. */
function formatPublicPriceDisplay(row: Record<string, unknown>): string {
  const ctxRaw = row.costContext ?? row.cost_context;
  const ctx =
    ctxRaw != null && typeof ctxRaw === "object" && !Array.isArray(ctxRaw)
      ? (ctxRaw as Record<string, unknown>)
      : null;
  const total =
    typeof ctx?.totalCost === "number"
      ? ctx.totalCost
      : typeof ctx?.total_cost === "number"
        ? ctx.total_cost
        : null;
  const currency =
    String(row.currencyCode ?? row.currency_code ?? ctx?.currency ?? "").trim() || "IRR";
  if (total == null) {
    return "قیمت پس از ثبت‌نام";
  }
  return `${total.toLocaleString("fa-IR")} ${currency}`;
}

/**
 * Maps a BFF catalog item to a guest-safe {@link PublicTour}.
 * Drops non-OPEN rows and strips private fields (cost_context stays server-side only).
 */
export function mapCatalogItemToPublicTour(input: unknown): PublicTour | null {
  if (input == null || typeof input !== "object") {
    return null;
  }
  const row = input as Record<string, unknown>;
  const lifecycle = String(row.lifecycleStatus ?? row.lifecycle_status ?? "")
    .trim()
    .toUpperCase();
  if (lifecycle !== "OPEN") {
    return null;
  }
  const id = pickStr(row, "id");
  const title = pickStr(row, "title");
  if (!id || !title) {
    return null;
  }
  return {
    id,
    title,
    acceptedCount: pickNum(row, "acceptedCount", "accepted_count") ?? 0,
    totalCapacity: pickNum(row, "totalCapacity", "total_capacity") ?? 0,
    lifecycleStatus: "OPEN",
    priceDisplay: formatPublicPriceDisplay(row),
  };
}

export async function fetchPublicCatalog(params: {
  apiStatus: PublicCatalogApiStatus;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PublicCatalogResult> {
  const qs = new URLSearchParams();
  qs.set("status", params.apiStatus);
  if (params.search?.trim()) {
    qs.set("search", params.search.trim());
  }
  if (params.page != null) {
    qs.set("page", String(params.page));
  }
  if (params.limit != null) {
    qs.set("limit", String(params.limit));
  }
  const raw = await bffBrowserClient.get<PublicCatalogBffResponse>(
    `/api/public/tours?${qs.toString()}`,
    { skip403Redirect: true },
  );
  const rows = Array.isArray(raw.items) ? raw.items : [];
  const tours = rows
    .map((row) => mapCatalogItemToPublicTour(row))
    .filter((tour): tour is PublicTour => tour != null);
  return {
    tours,
    total: raw.total ?? tours.length,
    page: raw.page ?? 1,
    limit: raw.limit ?? 24,
  };
}

export async function fetchPublicTourDetail(tourId: string): Promise<TourDetailDto> {
  return bffBrowserClient.get<TourDetailDto>(`/api/public/tours/${encodeURIComponent(tourId)}`, {
    skip403Redirect: true,
  });
}

export async function mintPublicRegistrationIdempotencyKey(tourId: string): Promise<string> {
  const raw = await bffBrowserClient.get<{ idempotencyKey?: string; idempotency_key?: string }>(
    `/api/public/tours/${encodeURIComponent(tourId)}/registration-idempotency-key`,
    { skip403Redirect: true },
  );
  const key = raw.idempotencyKey ?? raw.idempotency_key;
  if (!key?.trim()) {
    throw new ApiError("INVALID_RESPONSE", "Missing idempotency key", 502, raw);
  }
  return key.trim();
}

export async function publicRegisterTourOpen(
  tourId: string,
  payload: CreateRegistrationPayload,
  options?: ApiRequestOptions,
): Promise<PublicRegisterOutcome> {
  const raw = await bffBrowserClient.post<unknown>(
    `/api/public/tours/${encodeURIComponent(tourId)}/register`,
    { ...payload, tourId },
    { idempotencyKey: true, ...options },
  );
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid register response");
  }
  const o = raw as Record<string, unknown>;

  if (o.registration != null && typeof o.registration === "object") {
    const paymentRaw = o.paymentIntent ?? o.payment_intent;
    return {
      outcome: "registered",
      booking: normalizeRegistrationPayload(o.registration),
      paymentIntent: coercePaymentIntentResponse(paymentRaw),
    };
  }

  const waitlistItemId = pickStr(o, "waitlistItemId", "waitlist_item_id");
  const queuePosition =
    pickNum(o, "waitlistPosition") ?? pickNum(o, "queuePosition") ?? pickNum(o, "queue_position");

  if (waitlistItemId && queuePosition != null) {
    return { outcome: "waitlisted", waitlistItemId, queuePosition };
  }

  throw new Error("Unexpected tour register response shape");
}
