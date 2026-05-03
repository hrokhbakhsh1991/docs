import type { TourDto, TourLifecycleStatus } from "@repo/types";

import { ApiError } from "@/lib/api-client";
import { mapTourResponseToDto } from "@/lib/mappers/tour.mapper";

import { apiClient } from "../api-client";

/** When true, list/read tours from `GET /api/v2/tours` (requires auth cookie). */
export function toursUseLiveApi(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_URL?.trim());
}

/** Tour row including lifecycle (UI/OpenAPI extension). */
export type TourDetailDto = TourDto & { lifecycleStatus: TourLifecycleStatus };

/**
 * Client payload for creating a tour (maps to Nest `CreateTourDto` on the wire).
 * `capacity` → `total_capacity`, `price` / optional `location` → `cost_context`.
 * `startDate` / `endDate` are intentionally omitted from the HTTP body.
 */
export type CreateTourDto = {
  title: string;
  description?: string;
  /** Stored in `cost_context.location` until the API adds a column. */
  location?: string;
  capacity: number;
  price: number;
  lifecycle_status: "Draft" | "Open";
};

/**
 * Edit-form payload → Nest `UpdateTourDto` (snake_case on wire).
 * Dates are not sent. Merge `existingCostContext` when patching `cost_context`.
 */
export type UpdateTourDto = {
  title: string;
  description?: string;
  capacity: number;
  price: number;
  lifecycle_status: TourLifecycleStatus;
  /** Preserved in `cost_context.location` when present. */
  location?: string;
};


/** OpenAPI `GET /api/v2/tours` declares only optional `search` query param (`ToursController_list`). */
export type GetToursParams = {
  search?: string;
};

export type PaginatedToursResult = {
  tours: TourDetailDto[];
  total: number;
  page: number;
  limit: number;
};

type PaginatedToursApiBody = {
  items?: unknown[];
  total?: number;
  page?: number;
  limit?: number;
};

/**
 * List tours with optional `search` (`GET /api/v2/tours` → {@link PaginatedToursApiBody}).
 */
export async function getTours(params?: GetToursParams): Promise<PaginatedToursResult> {
  const search = params?.search?.trim() ?? "";
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  const path = qs.toString() ? `/api/v2/tours?${qs}` : `/api/v2/tours`;
  const raw = await apiClient.get<PaginatedToursApiBody>(path);
  const rows = Array.isArray(raw.items) ? raw.items : [];
  const pageFallback = 1;
  const limitFallback = rows.length || 10;
  return {
    tours: rows.map((row) => mapTourResponseToDto(row)),
    total: typeof raw.total === "number" ? raw.total : rows.length,
    page: typeof raw.page === "number" ? raw.page : pageFallback,
    limit: typeof raw.limit === "number" ? raw.limit : limitFallback,
  };
}

export async function getTourById(id: string): Promise<TourDetailDto | null> {
  try {
    const row = await apiClient.get<unknown>(`/api/v2/tours/${encodeURIComponent(id)}`);
    return mapTourResponseToDto(row);
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function buildCostContextForCreate(dto: CreateTourDto): Record<string, unknown> | undefined {
  const ctx: Record<string, unknown> = {};
  const loc = dto.location?.trim();
  if (loc) {
    ctx.location = loc;
  }
  if (typeof dto.price === "number" && Number.isFinite(dto.price)) {
    ctx.currency = "USD";
    ctx.totalCost = dto.price;
  }
  return Object.keys(ctx).length > 0 ? ctx : undefined;
}

/** Builds Nest `CreateTourDto` JSON (snake_case). */
function toCreateTourApiBody(dto: CreateTourDto): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: dto.title.trim(),
    total_capacity: dto.capacity,
    lifecycle_status: dto.lifecycle_status,
  };
  const desc = dto.description?.trim();
  if (desc) {
    body.description = desc;
  }
  const cost = buildCostContextForCreate(dto);
  if (cost) {
    body.cost_context = cost;
  }
  return body;
}

export async function createTour(dto: CreateTourDto): Promise<TourDetailDto> {
  const idempotencyKey =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const raw = await apiClient.post<unknown>("/api/v2/tours", toCreateTourApiBody(dto), {
    idempotencyKey,
  });
  return mapTourResponseToDto(raw);
}

function toUpdateTourApiBody(
  dto: UpdateTourDto,
  existingCostContext?: Record<string, unknown> | null
): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...(existingCostContext &&
    typeof existingCostContext === "object" &&
    !Array.isArray(existingCostContext)
      ? { ...existingCostContext }
      : {}),
  };
  merged.currency = "USD";
  merged.totalCost = dto.price;
  const loc = dto.location?.trim();
  if (loc) {
    merged.location = loc;
  } else {
    delete merged.location;
  }

  return {
    title: dto.title.trim(),
    total_capacity: dto.capacity,
    lifecycle_status: dto.lifecycle_status,
    description: dto.description ?? "",
    cost_context: merged,
  };
}

export async function updateTour(
  id: string,
  dto: UpdateTourDto,
  options?: { existingCostContext?: Record<string, unknown> | null }
): Promise<TourDetailDto | null> {
  const idempotencyKey =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const raw = await apiClient.patch<unknown>(
    `/api/v2/tours/${encodeURIComponent(id)}`,
    toUpdateTourApiBody(dto, options?.existingCostContext ?? null),
    { idempotencyKey }
  );
  return mapTourResponseToDto(raw);
}
