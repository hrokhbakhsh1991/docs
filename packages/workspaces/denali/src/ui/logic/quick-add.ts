import type { DestinationResource, EquipmentResource } from "../adapters/catalog-types";

type CreatedRow = { id: string; name: string };
type DestinationType = "generic" | "peak" | "nature_trail";
type CreatedDestination = CreatedRow & { regionId: string; locationType: DestinationType };
type GearChoice = { equipmentId: string; name: string; isRequired: boolean };
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function parseCreatedRow(kind: "equipment", value: unknown): CreatedRow | null;
export function parseCreatedRow(
  kind: "destination",
  value: unknown,
  expectedRegionId: string
): CreatedDestination | null;
export function parseCreatedRow(
  kind: "equipment" | "destination",
  value: unknown,
  expectedRegionId?: string
): CreatedRow | CreatedDestination | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { id, name, regionId, locationType } = value as Record<string, unknown>;
  if (typeof id !== "string" || !UUID.test(id) || typeof name !== "string" || !name.trim()) {
    return null;
  }
  if (kind === "equipment") return { id, name: name.trim() };
  if (regionId !== expectedRegionId || typeof regionId !== "string" || !UUID.test(regionId)) {
    return null;
  }
  if (locationType !== "generic" && locationType !== "peak" && locationType !== "nature_trail") {
    return null;
  }
  return { id, name: name.trim(), regionId, locationType };
}

export function appendGearSelection(
  current: readonly GearChoice[],
  row: CreatedRow,
  isRequired: boolean
): readonly GearChoice[] {
  if (current.some((item) => item.equipmentId === row.id)) return current;
  return [...current, { equipmentId: row.id, name: row.name, isRequired }];
}

/** Overlay only unobserved confirmed creates; discard overlay entries once a fresh GET observes them. */
export function mergeConfirmedRows<T extends { id: string }>(
  authoritative: readonly T[],
  confirmed: readonly T[]
): T[] {
  const byId = new Map(authoritative.map((row) => [row.id, row] as const));
  for (const row of confirmed) if (!byId.has(row.id)) byId.set(row.id, row);
  return [...byId.values()];
}

function validDestinationDetails(value: unknown): value is DestinationResource {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.isActive === "boolean" &&
    typeof row.sortOrder === "number" &&
    (row.altitudeM === null ||
      (typeof row.altitudeM === "number" && Number.isFinite(row.altitudeM))) &&
    (row.typicalTrailDistanceKm === null ||
      (typeof row.typicalTrailDistanceKm === "number" &&
        Number.isFinite(row.typicalTrailDistanceKm)))
  );
}

function validEquipmentDetails(value: unknown): value is EquipmentResource {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    (row.category === null || typeof row.category === "string") &&
    typeof row.sortOrder === "number" &&
    Array.isArray(row.themeIds) &&
    row.themeIds.every((id) => typeof id === "string") &&
    (row.iconKey == null || typeof row.iconKey === "string") &&
    (row.compatibleCategories === undefined ||
      (Array.isArray(row.compatibleCategories) &&
        row.compatibleCategories.every((category) => typeof category === "string")))
  );
}

export function parseCreatedCatalogResource(
  kind: "destination",
  value: unknown,
  expectedRegionId: string
): DestinationResource | null;
export function parseCreatedCatalogResource(
  kind: "equipment",
  value: unknown
): EquipmentResource | null;
export function parseCreatedCatalogResource(
  kind: "destination" | "equipment",
  value: unknown,
  expectedRegionId?: string
): DestinationResource | EquipmentResource | null {
  if (kind === "destination") {
    return expectedRegionId &&
      parseCreatedRow("destination", value, expectedRegionId) &&
      validDestinationDetails(value)
      ? value
      : null;
  }
  return parseCreatedRow("equipment", value) && validEquipmentDetails(value) ? value : null;
}

export function canApplyQuickAddResult(
  mounted: boolean,
  submittedDraft: unknown,
  currentDraft: unknown
): boolean {
  return mounted && Object.is(submittedDraft, currentDraft);
}

export function parseQuickAddMetric(raw: string, decimal: boolean): number | null | undefined {
  const normalized = raw
    .trim()
    .replace(/[۰-۹٠-٩]/g, (digit) =>
      String(
        digit.charCodeAt(0) >= 0x6f0 ? digit.charCodeAt(0) - 0x6f0 : digit.charCodeAt(0) - 0x660
      )
    )
    .replace(/٫/g, ".");
  if (normalized === "") return undefined;
  if (!(decimal ? /^\d+(?:\.\d{1,2})?$/ : /^\d+$/).test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 && amount <= 2147483647 ? amount : null;
}

export function retireObservedRows<T extends { id: string }>(
  confirmed: readonly T[],
  observedIds: ReadonlySet<string>
): readonly T[] {
  const unseen = confirmed.filter((row) => !observedIds.has(row.id));
  return unseen.length === confirmed.length ? confirmed : unseen;
}
