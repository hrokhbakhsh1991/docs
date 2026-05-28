import type {
  TourDetailAccessLevel,
  TourDetailViewHints,
  TourDto,
  TourFormProfile,
  TourLifecycleStatus,
  TourType,
} from "@repo/types";

import { ApiError } from "@/lib/api-client";
import { tourCreateContractSchema } from "@/features/tours/contracts/tour-form-contract";
import type { TourTripDetails } from "@/features/tours/models/tourTripDetails.schema";
import { mapTourResponseToDto } from "@/lib/mappers/tour.mapper";
import { bffBrowserClient } from "@/lib/api/bff-browser-client";
import { BFF } from "@/lib/api-paths";
import { getWizardSubmitIdempotencyKey } from "@/features/tours/wizard/wizardSubmitSession";
import { debugSessionLog, summarizeDenaliCreatePayload } from "@/lib/debug-session-log";
import { isTourOpsApiConfigured } from "../tour-ops-api-origin";

/** When true, list/read tours via same-origin BFF `GET /api/tours` (session cookie). */
export function toursUseLiveApi(): boolean {
  return isTourOpsApiConfigured();
}

/** Tour row from BFF `GET /api/tours/:id` after {@link mapTourResponseToDto}. */
export type TourDetailDto = TourDto & {
  accessLevel?: TourDetailAccessLevel;
  viewHints?: TourDetailViewHints;
};

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
 * **Wire keys:** allowed top-level POST properties are {@link CREATE_TOUR_POST_WIRE_KEYS}
 * in `@repo/shared-contracts` (kept in sync with Nest `CreateTourDto`).
 */
export type CreateTourDto = {
  title: string;
  description?: string;
  /** Stored in `cost_context.location` until the API adds a column. */
  location?: string;
  autoAcceptRegistrations: boolean;
  tourType?: TourType;
  /**
   * Not sent on tour create POST — server resolves profile from workspace template.
   * Retained on the type for callers that still carry profile in memory (client strip only).
   */
  formProfile?: TourFormProfile;
  /** Multi-select; omit or `[]` when none. No `mixed` — pick every mode that applies. */
  transportModes?: ("bus" | "train" | "plane" | "private_car")[];
  /** Maps to `chat_link` on the wire. */
  communicationLink?: string;
  /** Nest `CreateTourDto.durationDays` (camelCase JSON). */
  durationDays?: number;
  /** Nest `CreateTourDto.meetingPoint` (camelCase JSON). */
  meetingPoint?: string;
  /** Sent to API for audit logging (Gap 1). */
  sourcePresetId?: string;
  /** Sent to API for audit logging (Gap 1). */
  sourceTourId?: string;
  /** Nest `CreateTourDto.tripDetails` → `tour_details.trip_details` (JSONB). */
  tripDetails?: TourTripDetails;
  /** Nest `CreateTourDto.destinationId` → `tours.destination_id`. */
  destinationId?: string | null;
  capacity: number;
  price: number;
  /** When true, persisted on `cost_context.requiresPayment` (finance module tours). */
  requiresPayment?: boolean;
  /** Denali pilot: persisted on `cost_context.paymentMode` when `requiresPayment` is true. */
  paymentMode?: "offline_receipt";
  lifecycle_status: "Draft" | "Open";
  /** Workspace-defined custom service labels (Denali-family profiles). */
  customServiceLabels?: string[];
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
  requiresPayment?: boolean;
  /** Omit on field-only edits; send only when publish status explicitly changes. */
  lifecycle_status?: TourLifecycleStatus;
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
  autoAcceptRegistrations?: boolean;
  paymentMode?: "offline_receipt";
  transportModes?: ("bus" | "train" | "plane" | "private_car")[];
  /** Workspace-defined custom service labels (Denali-family profiles). */
  customServiceLabels?: string[];
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
  const path = BFF.toursQuery(qs.toString());
  const raw = await bffBrowserClient.get<PaginatedToursApiBody>(path);
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
    const row = await bffBrowserClient.get<unknown>(BFF.tour(id));
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
  if (dto.requiresPayment === true) {
    ctx.requiresPayment = true;
  }
  if (dto.paymentMode === "offline_receipt") {
    ctx.paymentMode = "offline_receipt";
  }
  return Object.keys(ctx).length > 0 ? ctx : undefined;
}

/**
 * Builds the JSON body for `POST /api/v2/tours` (mixed snake_case + camelCase, matching Nest `CreateTourDto`).
 * Exported for contract tests against `CREATE_TOUR_POST_WIRE_KEYS` (`@repo/shared-contracts`).
 * Never includes `formProfile` even if the in-memory {@link CreateTourDto} carries it.
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
  if (dto.sourcePresetId) {
    body.sourcePresetId = dto.sourcePresetId;
  }
  if (dto.sourceTourId) {
    body.sourceTourId = dto.sourceTourId;
  }
  if (dto.customServiceLabels && dto.customServiceLabels.length > 0) {
    body.customServiceLabels = dto.customServiceLabels;
  }
  delete body.formProfile;
  if (process.env.NODE_ENV !== "production") {
    const parsed = tourCreateContractSchema.safeParse(body);
    if (!parsed.success) {
    }
  }
  return body;
}

export type CreateTourOptions = {
  /** Reuse until create succeeds (map-phase P1.2); defaults to a new UUID per call. */
  idempotencyKey?: string;
};

export async function createTour(
  dto: CreateTourDto,
  options?: CreateTourOptions,
): Promise<TourDetailDto> {
  const idempotencyKey =
    options?.idempotencyKey?.trim() ||
    (typeof window !== "undefined"
      ? getWizardSubmitIdempotencyKey()
      : typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`);
  const body = buildCreateTourPostBody(dto);
  debugSessionLog(
    "tours.service.ts:createTour",
    "POST /tours wire body summary",
    {
      ...summarizeDenaliCreatePayload(dto),
      wireKeys: Object.keys(body),
      wireTransportModes: body.transportModes,
      wireLifecycle: body.lifecycle_status,
    },
    "A",
  );
  try {
    const raw = await bffBrowserClient.post<unknown>(BFF.tours, body, {
      idempotencyKey,
      /** Let `/tours/new` show inline permission errors instead of a full-page `/403` redirect. */
      skip403Redirect: true,
    });
    debugSessionLog(
      "tours.service.ts:createTour",
      "POST /tours succeeded",
      { tourId: (raw as { id?: string })?.id ?? "unknown" },
      "E",
    );
    return mapTourResponseToDto(raw);
  } catch (err) {
    debugSessionLog(
      "tours.service.ts:createTour",
      "POST /tours rejected",
      {
        status: err instanceof ApiError ? err.status : undefined,
        code: err instanceof ApiError ? err.code : undefined,
        message: err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err),
        primaryTransportMode: summarizeDenaliCreatePayload(dto).primaryTransportMode,
      },
      "E",
    );
    throw err;
  }
}

/** Reads `requiresPayment` from persisted `cost_context` (camelCase or snake_case). */
export function costContextRequiresPayment(
  ctx: Record<string, unknown> | null | undefined,
): boolean {
  if (!ctx || typeof ctx !== "object" || Array.isArray(ctx)) {
    return false;
  }
  return Boolean(ctx.requiresPayment ?? ctx.requires_payment);
}

/** @internal Exported for unit tests — maps edit DTO to Nest PATCH body. */
export function toUpdateTourApiBody(
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
  const preserveRequiresPayment =
    dto.requiresPayment === true || costContextRequiresPayment(existingCostContext);
  if (preserveRequiresPayment) {
    merged.requiresPayment = true;
  } else {
    delete merged.requiresPayment;
    delete merged.paymentMode;
  }
  if (dto.paymentMode === "offline_receipt" && preserveRequiresPayment) {
    merged.paymentMode = "offline_receipt";
  }
  const loc = dto.location?.trim();
  if (loc) {
    merged.location = loc;
  } else {
    delete merged.location;
  }

  const body: Record<string, unknown> = {
    title: dto.title.trim(),
    total_capacity: dto.capacity,
    description: dto.description ?? "",
    cost_context: merged,
  };
  if (dto.lifecycle_status !== undefined) {
    body.lifecycle_status = dto.lifecycle_status;
  }
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
  if (dto.autoAcceptRegistrations !== undefined) {
    body.autoAcceptRegistrations = dto.autoAcceptRegistrations;
  }
  if (dto.transportModes !== undefined) {
    body.transportModes = dto.transportModes;
  }
  if (dto.customServiceLabels !== undefined) {
    body.customServiceLabels = dto.customServiceLabels;
  }
  return body;
}

/** Row returned by `POST /api/v2/tours/:tourId/photos` (presigned preview URL). */
export type TourGalleryPhotoDto = {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
};

function parseTourGalleryPhotoRow(raw: unknown): TourGalleryPhotoDto | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const url = typeof row.url === "string" ? row.url.trim() : "";
  if (!id || !url) return null;
  return {
    id,
    url,
    filename: typeof row.filename === "string" ? row.filename : "photo",
    size: typeof row.size === "number" && Number.isFinite(row.size) ? row.size : 0,
    mimeType: typeof row.mimeType === "string" ? row.mimeType : "image/jpeg",
    uploadedAt:
      typeof row.uploadedAt === "string" ? row.uploadedAt : new Date().toISOString(),
  };
}

/** Upload gallery images for an existing tour (edit mode). */
export async function uploadTourPhotos(
  tourId: string,
  files: readonly File[],
): Promise<TourGalleryPhotoDto[]> {
  const trimmedId = tourId.trim();
  if (!trimmedId || files.length === 0) {
    return [];
  }
  const formData = new FormData();
  for (const file of files) {
    formData.append("photos", file);
  }
  const raw = await bffBrowserClient.postForm<unknown>(BFF.tourPhotos(trimmedId), formData);
  const rows = Array.isArray(raw) ? raw : Array.isArray((raw as { items?: unknown[] })?.items) ? (raw as { items: unknown[] }).items : [];
  return rows
    .map((row) => parseTourGalleryPhotoRow(row))
    .filter((row): row is TourGalleryPhotoDto => row != null);
}

export async function updateTour(
  id: string,
  dto: UpdateTourDto,
  options?: { existingCostContext?: Record<string, unknown> | null }
): Promise<TourDetailDto | null> {
  const idempotencyKey =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  const raw = await bffBrowserClient.patch<unknown>(
    BFF.tour(id),
    toUpdateTourApiBody(dto, options?.existingCostContext ?? null),
    { idempotencyKey }
  );
  return mapTourResponseToDto(raw);
}
