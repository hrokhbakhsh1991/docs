import type { TourDto } from "@repo/types";

/** Display label for tour/registrations dates (`yyyy-mm-dd` or ISO-8601 instant). */
export function formatTourDateLabel(iso: string): string {
  if (!iso.trim()) return "—";
  const d = iso.includes("T") ? new Date(iso) : new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function formatTourPriceUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

/** Reads `costContext` (`totalCost` / `amount`). */
export function extractTourPriceUsd(costContext: Record<string, unknown> | null | undefined): number {
  if (!costContext || typeof costContext !== "object") return 0;
  const raw = costContext.totalCost ?? costContext.amount;
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  return Number.isFinite(n) ? n : 0;
}

export function buildCostContextUsd(totalCost: number): Record<string, unknown> {
  return { currency: "USD", totalCost };
}

/** `TourDto` exposes `startDate` / `endDate` (ISO instants when present). */
export function formatTourDateRange(tour: TourDto): string {
  const start = tour.startDate?.trim() ?? "";
  const end = tour.endDate?.trim() ?? "";
  if (!start && !end) return "—";
  if (start && end) return `${formatTourDateLabel(start)} → ${formatTourDateLabel(end)}`;
  return formatTourDateLabel(start || end);
}

/**
 * Location is projected in `cost_context.location` when the leader saves it (OpenAPI `cost_context` is free-form object).
 */
export function formatTourLocation(tour: TourDto): string {
  const ctx = tour.costContext;
  if (!ctx || typeof ctx !== "object") return "—";
  const loc = ctx.location;
  if (typeof loc === "string" && loc.trim() !== "") return loc.trim();
  return "—";
}
