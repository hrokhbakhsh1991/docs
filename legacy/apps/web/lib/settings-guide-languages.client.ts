import { pickSettingsErrorMessage } from "@/lib/settings-locations-client";

export type SettingsGuideLanguageDto = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateGuideLanguagePayload = {
  name: string;
  slug: string;
  isActive?: boolean;
  sortOrder?: number;
};

export type UpdateGuideLanguagePayload = Partial<CreateGuideLanguagePayload>;

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

export async function getGuideLanguages(): Promise<SettingsGuideLanguageDto[]> {
  const res = await fetch("/api/settings/guide-languages", { credentials: "include", cache: "no-store" });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to load guide languages"));
  }
  if (!Array.isArray(body)) {
    throw new Error("Invalid guide languages response");
  }
  return body as SettingsGuideLanguageDto[];
}

export async function createGuideLanguage(payload: CreateGuideLanguagePayload): Promise<SettingsGuideLanguageDto> {
  const res = await fetch("/api/settings/guide-languages", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to create guide language"));
  }
  return body as SettingsGuideLanguageDto;
}

export async function updateGuideLanguage(
  id: string,
  payload: UpdateGuideLanguagePayload,
): Promise<SettingsGuideLanguageDto> {
  const res = await fetch(`/api/settings/guide-languages/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to update guide language"));
  }
  return body as SettingsGuideLanguageDto;
}

export async function deleteGuideLanguage(id: string): Promise<void> {
  const res = await fetch(`/api/settings/guide-languages/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to delete guide language"));
  }
}

export async function reorderGuideLanguages(itemIds: string[]): Promise<SettingsGuideLanguageDto[]> {
  const res = await fetch("/api/settings/guide-languages/reorder", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemIds }),
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to reorder guide languages"));
  }
  if (!Array.isArray(body)) {
    throw new Error("Invalid guide languages reorder response");
  }
  return body as SettingsGuideLanguageDto[];
}
