import type { TourFormProfile } from "@repo/types";
import { normalizeTourFormProfileInput } from "@repo/types";

import { pickSettingsErrorMessage } from "@/lib/settings-locations-client";

export type SettingsTourThemeDto = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  formProfile: TourFormProfile;
  createdAt: string;
  updatedAt: string;
};

export type CreateTourThemePayload = {
  name: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  formProfile?: TourFormProfile;
};

export type UpdateTourThemePayload = Partial<CreateTourThemePayload>;

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

export async function getTourThemes(): Promise<SettingsTourThemeDto[]> {
  const res = await fetch("/api/settings/tour-themes", { credentials: "include", cache: "no-store" });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to load tour themes"));
  }
  if (!Array.isArray(body)) {
    throw new Error("Invalid tour themes response");
  }
  return (body as SettingsTourThemeDto[]).map((row) => ({
    ...row,
    formProfile: normalizeTourFormProfileInput((row as { formProfile?: unknown }).formProfile),
  }));
}

export async function createTourTheme(payload: CreateTourThemePayload): Promise<SettingsTourThemeDto> {
  const res = await fetch("/api/settings/tour-themes", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to create tour theme"));
  }
  return {
    ...(body as SettingsTourThemeDto),
    formProfile: normalizeTourFormProfileInput((body as { formProfile?: unknown }).formProfile),
  };
}

export async function updateTourTheme(
  id: string,
  payload: UpdateTourThemePayload,
): Promise<SettingsTourThemeDto> {
  const res = await fetch(`/api/settings/tour-themes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to update tour theme"));
  }
  return {
    ...(body as SettingsTourThemeDto),
    formProfile: normalizeTourFormProfileInput((body as { formProfile?: unknown }).formProfile),
  };
}

export async function deleteTourTheme(id: string): Promise<void> {
  const res = await fetch(`/api/settings/tour-themes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to delete tour theme"));
  }
}

export async function reorderTourThemes(itemIds: string[]): Promise<SettingsTourThemeDto[]> {
  const res = await fetch("/api/settings/tour-themes/reorder", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemIds }),
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to reorder tour themes"));
  }
  if (!Array.isArray(body)) {
    throw new Error("Invalid tour themes reorder response");
  }
  return (body as SettingsTourThemeDto[]).map((row) => ({
    ...row,
    formProfile: normalizeTourFormProfileInput((row as { formProfile?: unknown }).formProfile),
  }));
}
