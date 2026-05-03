import type { TourDto, TourLifecycleStatus } from "@repo/types";

import type { TourDetailDto } from "../services/tours.service";

const LIFECYCLE_VALUES = new Set<TourLifecycleStatus>(["DRAFT", "OPEN", "CLOSED", "CANCELLED"]);

function normalizeLifecycle(value: unknown): TourLifecycleStatus {
  const raw = String(value ?? "").trim().toUpperCase();
  if (LIFECYCLE_VALUES.has(raw as TourLifecycleStatus)) {
    return raw as TourLifecycleStatus;
  }
  return "DRAFT";
}

function normalizeDate(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string") {
    const t = value.trim();
    return t === "" ? null : t;
  }
  return null;
}

function normalizeCostContext(value: unknown): Record<string, unknown> | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Maps a loose JSON row from `GET /api/v2/tours` (serialized entity + OpenAPI fields)
 * into {@link TourDto} + `lifecycleStatus` for list/detail UI.
 */
export function mapTourResponseToDto(raw: unknown): TourDetailDto {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid tour payload");
  }
  const o = raw as Record<string, unknown>;

  const tour: TourDto = {
    id: String(o.id ?? ""),
    title: String(o.title ?? ""),
    description: o.description == null ? null : String(o.description),
    totalCapacity: num(o.totalCapacity ?? o.total_capacity),
    acceptedCount: num(o.acceptedCount ?? o.accepted_count),
    costContext: normalizeCostContext(o.costContext ?? o.cost_context),
    startDate: normalizeDate(o.startDate ?? o.start_date),
    endDate: normalizeDate(o.endDate ?? o.end_date),
  };

  const lifecycleStatus = normalizeLifecycle(o.lifecycleStatus ?? o.lifecycle_status);

  return {
    ...tour,
    lifecycleStatus,
  };
}
