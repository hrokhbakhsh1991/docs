import type { TourDto, TourLifecycleStatus, TourFormProfile, TourType } from "@repo/types";

import { ApiError } from "@/lib/api-client";
import type { TourTripDetails } from "@/features/tours/models/tourTripDetails.schema";
import { mapTourResponseToDto } from "@/lib/mappers/tour.mapper";

import { apiClient } from "../api-client";
import { API } from "../api-paths";
import { isTourOpsApiConfigured } from "../tour-ops-api-origin";

/** When true, list/read tours from `GET /api/v2/tours` (requires auth cookie). */
export function toursUseLiveApi(): boolean {
  return isTourOpsApiConfigured();
}

/** Tour row from `GET /api/v2/tours` after {@link mapTourResponseToDto}. */
export type TourDetailDto = TourDto;

/**
 * Client payload for creating a tour (maps to Nest `CreateTourDto` on the wire).
 *
 * **Server contract:** `apps/api/src/modules/tours/dto/create-tour.dto.ts` — optional top-level
 * fields such as `destinationName`, `elevationM`, `difficulty`, and legacy `itinerary[]` exist on
 * the API DTO but are **not** represented on this client type; the wizard today sends structured
 * data primarily via `tripDetails` + `mapCreateTourDto` / `compactTripDetailsForApi`. Keep in sync
 * with OpenAPI `POST /api/v2/tours` when adding fields here.
 *
 * `capacity` → `total_capacity`, `price` / optional `location` → `cost_context`.
 * Tour schedule dates are not part of the MVP API; the client does not send them.
 *
 * **Wire keys:** allowed top-level POST properties are enumerated as {@link CREATE_TOUR_DTO_WIRE_KEYS}
 * in `@repo/shared-contracts` (kept in sync with Nest `CreateTourDto`).
 */
export type CreateTourDto = {
  title: string;
  description?: string;
  /** Stored in `cost_context.location` until the API adds a column. */
  location?: string;
  autoAcceptRegistrations: boolean;
  tourType?: TourType;
  /** Nest `CreateTourDto.formProfile` — canonical profile for strip/invariants (optional). */
  formProfile?: TourFormProfile;
  /** Multi-select; omit or `[]` when none. No `mixed` — pick every mode that applies. */
  transportModes?: ("bus" | "train" | "plane" | "private_car")[];
  /** Maps to `chat_link` on the wire. */
  communicationLink?: string;
  /** Nest `CreateTourDto.durationDays` (camelCase JSON). */
  durationDays?: number;
  /** Nest `CreateTourDto.meetingPoint` (camelCase JSON). */
  meetingPoint?: string;
  /** Nest `CreateTourDto.tripDetails` → `tour_details.trip_details` (JSONB). */
  tripDetails?: TourTripDetails;
  /** Nest `CreateTourDto.destinationId` → `tours.destination_id`. */
  destinationId?: string | null;
  capacity: number;
  price: number;
  lifecycle_status: "Draft" | "Open";
};

/**
 * Edit-form payload → Nest `UpdateTourDto` (snake_case on wire).
 * Merge `existingCostContext` when patching `cost_context`.
 */
export type UpdateTourDto = {
  title: string;
  description?: string;
  capacity: number;
  price: number;
  lifecycle_status: TourLifecycleStatus;
  /** Preserved in `cost_context.location` when present. */
  location?: string;
  /** Maps to `chat_link` on the wire when non-empty after trim. */
  communicationLink?: string;
  /** Nest `UpdateTourDto.formProfile` — optional; aligns PATCH strip/snapshot with theme-derived profile when set. */
  formProfile?: TourFormProfile;
  /** Nest `UpdateTourDto.tripDetails` → merged into `tour_details.trip_details` (JSONB). */
  tripDetails?: TourTripDetails;
  /** Nest `UpdateTourDto.destinationId` → `tours.destination_id` (send `null` to clear). */
  destinationId?: string | null;
};


/** Query params for `GET /api/v2/tours` (search, pagination, optional lifecycle bucket). */
export type GetToursParams = {
  search?: string;
  page?: number;
  limit?: number;
  /** Matches list URL: DRAFT / OPEN / CLOSED|CANCELLED buckets. Omit or use only with live API. */
  status?: "active" | "completed" | "archived";
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
 * List tours with optional `search`, `page`, `limit`, and `status` (`GET /api/v2/tours`).
 */
export async function getTours(params?: GetToursParams): Promise<PaginatedToursResult> {
  const search = params?.search?.trim() ?? "";
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (params?.page != null) qs.set("page", String(params.page));
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const st = params?.status;
  if (st === "active" || st === "completed" || st === "archived") {
    qs.set("status", st);
  }
  const path = API.toursQuery(qs.toString());
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
    const row = await apiClient.get<unknown>(API.tour(id));
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

/**
 * Builds the JSON body for `POST /api/v2/tours` (mixed snake_case + camelCase, matching Nest `CreateTourDto`).
 * Exported for contract tests against `CREATE_TOUR_DTO_WIRE_KEYS` (`@repo/shared-contracts`).
 */
export function buildCreateTourPostBody(dto: CreateTourDto): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: dto.title.trim(),
    total_capacity: dto.capacity,
    lifecycle_status: dto.lifecycle_status,
    autoAcceptRegistrations: dto.autoAcceptRegistrations,
  };
  const desc = dto.description?.trim();
  if (desc) {
    body.description = desc;
  }
  const cost = buildCostContextForCreate(dto);
  if (cost) {
    body.cost_context = cost;
  }
  const link = dto.communicationLink?.trim();
  if (link) {
    body.chat_link = link;
  }
  if (dto.tourType) {
    body.tourType = dto.tourType;
  }
  if (dto.formProfile) {
    body.formProfile = dto.formProfile;
  }
  if (dto.transportModes && dto.transportModes.length > 0) {
    body.transportModes = dto.transportModes;
  }
  if (
    typeof dto.durationDays === "number" &&
    Number.isInteger(dto.durationDays) &&
    dto.durationDays > 0
  ) {
    body.durationDays = dto.durationDays;
  }
  const meeting = dto.meetingPoint?.trim();
  if (meeting) {
    body.meetingPoint = meeting;
  }
  if (
    dto.tripDetails != null &&
    typeof dto.tripDetails === "object" &&
    Object.keys(dto.tripDetails).length > 0
  ) {
    /** Normalized in {@link mapCreateTourDto} via `compactTripDetailsForApi` (JSON-safe, no `undefined` keys). */
    body.tripDetails = dto.tripDetails;
  }
  if (dto.destinationId != null && dto.destinationId !== "") {
    body.destinationId = dto.destinationId;
  }
  return body;
}

export async function createTour(dto: CreateTourDto): Promise<TourDetailDto> {
  const idempotencyKey =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const raw = await apiClient.post<unknown>(API.tours, buildCreateTourPostBody(dto), {
    idempotencyKey,
    /** Let `/tours/new` show inline permission errors instead of a full-page `/403` redirect. */
    skip403Redirect: true,
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

  const body: Record<string, unknown> = {
    title: dto.title.trim(),
    total_capacity: dto.capacity,
    lifecycle_status: dto.lifecycle_status,
    description: dto.description ?? "",
    cost_context: merged,
  };
  const link = dto.communicationLink?.trim();
  if (link) {
    body.chat_link = link;
  }
  if (
    dto.tripDetails != null &&
    typeof dto.tripDetails === "object" &&
    Object.keys(dto.tripDetails).length > 0
  ) {
    body.tripDetails = dto.tripDetails;
  }
  if (dto.destinationId !== undefined) {
    body.destinationId = dto.destinationId;
  }
  if (dto.formProfile) {
    body.formProfile = dto.formProfile;
  }
  return body;
}

export async function updateTour(
  id: string,
  dto: UpdateTourDto,
  options?: { existingCostContext?: Record<string, unknown> | null }
): Promise<TourDetailDto | null> {
  const idempotencyKey =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const raw = await apiClient.patch<unknown>(
    API.tour(id),
    toUpdateTourApiBody(dto, options?.existingCostContext ?? null),
    { idempotencyKey }
  );
  return mapTourResponseToDto(raw);
}
