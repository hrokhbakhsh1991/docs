import type {
  PublicCatalogTransportMode,
  PublicCatalogTransportSnapshot,
} from "@app-tour/workspace-sdk";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readCanonicalPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? value : Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

const TRANSPORT_MODES: readonly PublicCatalogTransportMode[] = [
  "organizer_vehicle",
  "bus",
  "minibus",
  "train",
  "shared_cars",
  "none",
];

function readTransportMode(data: Record<string, unknown>): PublicCatalogTransportMode {
  const raw =
    readString(readCanonicalPath(data, "transport.mode")) ??
    readString(readCanonicalPath(data, "transport.transportMode"));
  if (raw !== null && (TRANSPORT_MODES as readonly string[]).includes(raw)) {
    return raw as PublicCatalogTransportMode;
  }
  return "none";
}

export function readDenaliCatalogTransportSnapshot(
  data: Record<string, unknown>
): PublicCatalogTransportSnapshot {
  const mode = readTransportMode(data);
  const allowPersonalCar = readBoolean(readCanonicalPath(data, "transport.allowPersonalCar"));
  const transportCostAmount = readInteger(readCanonicalPath(data, "transport.transportCost"));
  const dongAmount = readInteger(readCanonicalPath(data, "transport.dongAmount"));

  return Object.freeze({
    mode,
    ...(allowPersonalCar ? { allowPersonalCar: true } : {}),
    ...(transportCostAmount !== null ? { transportCostAmount } : {}),
    ...(dongAmount !== null ? { dongAmount } : {}),
  });
}

export function readDenaliCatalogFatherNameRequired(data: Record<string, unknown>): boolean {
  return (
    readBoolean(readCanonicalPath(data, "participantRequirements.fatherNameRequired")) ||
    readBoolean(readCanonicalPath(data, "participants.fatherNameRequired"))
  );
}

export function readDenaliCatalogBirthDateRequired(data: Record<string, unknown>): boolean {
  return (
    readBoolean(readCanonicalPath(data, "participantRequirements.birthDateRequired")) ||
    readBoolean(readCanonicalPath(data, "participants.birthDateRequired"))
  );
}
