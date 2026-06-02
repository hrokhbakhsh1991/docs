export type SettingsRegionDto = {
  id: string;
  name: string;
  country: string | null;
  sortOrder: number | null;
  isActive: boolean;
};

export type SettingsDestinationDto = {
  id: string;
  name: string;
  regionId: string;
  type: string | null;
  altitudeM: number | null;
  sortOrder: number | null;
  isActive: boolean;
};

export type CreateRegionPayload = {
  name: string;
  country: string | null;
  sortOrder: number | null;
  isActive: boolean;
};

export type UpdateRegionPayload = Partial<CreateRegionPayload>;

export type CreateDestinationPayload = {
  name: string;
  regionId: string;
  type: string | null;
  altitudeM: number | null;
  sortOrder: number | null;
  isActive: boolean;
};

export type UpdateDestinationPayload = Partial<CreateDestinationPayload>;

function isSchemaDriftCode(code: unknown): boolean {
  return (
    code === "SCHEMA_DRIFT_MISSING_TABLE" ||
    code === "SCHEMA_DRIFT_MISSING_COLUMN" ||
    code === "SCHEMA_DRIFT_QUERY_FAILED"
  );
}

const SCHEMA_DRIFT_HINT =
  " — برای هماهنگ‌سازی دیتابیس از ریشهٔ مخزن اجرا کنید: pnpm --filter @apps/api run migrate:run (با apps/api/.env که DATABASE_* دارد).";

export function pickSettingsErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error?: { message?: unknown; code?: unknown } }).error;
    if (err && typeof err.message === "string" && err.message.trim() !== "") {
      const msg = err.message.trim();
      if (isSchemaDriftCode(err.code)) {
        return `${msg}${SCHEMA_DRIFT_HINT}`;
      }
      return msg;
    }
  }
  return fallback;
}

async function parseJsonOrEmpty(res: Response): Promise<unknown> {
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return null;
  }
  const text = await res.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function fetchSettingsRegions(): Promise<SettingsRegionDto[]> {
  const res = await fetch("/api/settings/regions", { credentials: "include", cache: "no-store" });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to load regions"));
  }
  if (!Array.isArray(body)) {
    throw new Error("Invalid regions response");
  }
  return body as SettingsRegionDto[];
}

export async function createSettingsRegion(payload: CreateRegionPayload): Promise<SettingsRegionDto> {
  const res = await fetch("/api/settings/regions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to create region"));
  }
  return body as SettingsRegionDto;
}

export async function updateSettingsRegion(
  regionId: string,
  payload: UpdateRegionPayload
): Promise<SettingsRegionDto> {
  const res = await fetch(`/api/settings/regions/${encodeURIComponent(regionId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to update region"));
  }
  return body as SettingsRegionDto;
}

export async function deleteSettingsRegion(regionId: string): Promise<void> {
  const res = await fetch(`/api/settings/regions/${encodeURIComponent(regionId)}`, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store"
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to delete region"));
  }
}

export async function fetchSettingsDestinations(): Promise<SettingsDestinationDto[]> {
  const res = await fetch("/api/settings/destinations", { credentials: "include", cache: "no-store" });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to load destinations"));
  }
  if (!Array.isArray(body)) {
    throw new Error("Invalid destinations response");
  }
  return body as SettingsDestinationDto[];
}

export async function createSettingsDestination(
  payload: CreateDestinationPayload
): Promise<SettingsDestinationDto> {
  const res = await fetch("/api/settings/destinations", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to create destination"));
  }
  return body as SettingsDestinationDto;
}

export async function updateSettingsDestination(
  destinationId: string,
  payload: UpdateDestinationPayload
): Promise<SettingsDestinationDto> {
  const res = await fetch(`/api/settings/destinations/${encodeURIComponent(destinationId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to update destination"));
  }
  return body as SettingsDestinationDto;
}

export async function deleteSettingsDestination(destinationId: string): Promise<void> {
  const res = await fetch(`/api/settings/destinations/${encodeURIComponent(destinationId)}`, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store"
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to delete destination"));
  }
}
