import { pickSettingsErrorMessage } from "@/lib/settings-locations-client";

export type SettingsTourPresetDto = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  matchTourType: string | null;
  matchMainTourThemeId: string | null;
  defaults: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateTourPresetPayload = {
  name: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  matchTourType?: string | null;
  matchMainTourThemeId?: string | null;
  defaults?: Record<string, unknown>;
};

export type UpdateTourPresetPayload = Partial<CreateTourPresetPayload>;

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

export async function getTourPresets(): Promise<SettingsTourPresetDto[]> {
  const res = await fetch("/api/settings/tour-presets", { credentials: "include", cache: "no-store" });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to load tour presets"));
  }
  if (!Array.isArray(body)) {
    throw new Error("Invalid tour presets response");
  }
  return body as SettingsTourPresetDto[];
}

export async function createTourPreset(payload: CreateTourPresetPayload): Promise<SettingsTourPresetDto> {
  const res = await fetch("/api/settings/tour-presets", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to create tour preset"));
  }
  return body as SettingsTourPresetDto;
}

export async function updateTourPreset(id: string, payload: UpdateTourPresetPayload): Promise<SettingsTourPresetDto> {
  const res = await fetch(`/api/settings/tour-presets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to update tour preset"));
  }
  return body as SettingsTourPresetDto;
}

export async function deleteTourPreset(id: string): Promise<void> {
  const res = await fetch(`/api/settings/tour-presets/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await parseJsonOrEmpty(res);
    throw new Error(pickSettingsErrorMessage(body, "Failed to delete tour preset"));
  }
}

export async function reorderTourPresets(itemIds: string[]): Promise<SettingsTourPresetDto[]> {
  const res = await fetch("/api/settings/tour-presets/reorder", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemIds }),
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to reorder tour presets"));
  }
  if (!Array.isArray(body)) {
    throw new Error("Invalid reorder response");
  }
  return body as SettingsTourPresetDto[];
}
