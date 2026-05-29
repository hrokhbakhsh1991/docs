import { pickSettingsErrorMessage } from "@/lib/settings-locations-client";

export type SettingsEquipmentDto = {
  id: string;
  name: string;
  slug: string;
  compatibleCategories: string[];
  description: string | null;
  icon: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateEquipmentPayload = {
  name: string;
  slug: string;
  compatibleCategories?: string[];
  description?: string | null;
  icon?: string | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type UpdateEquipmentPayload = Partial<CreateEquipmentPayload>;

function normalizeEquipmentDto(row: unknown): SettingsEquipmentDto {
  const record = row as Record<string, unknown>;
  const compatibleRaw = record.compatibleCategories;
  const compatibleCategories = Array.isArray(compatibleRaw)
    ? compatibleRaw.filter((v): v is string => typeof v === "string")
    : [];
  return {
    id: String(record.id),
    name: String(record.name),
    slug: String(record.slug),
    compatibleCategories,
    description: record.description == null ? null : String(record.description),
    icon: record.icon == null ? null : String(record.icon),
    isActive: Boolean(record.isActive),
    sortOrder: Number(record.sortOrder ?? 0),
    createdAt: String(record.createdAt),
    updatedAt: String(record.updatedAt),
  };
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

export async function getEquipment(): Promise<SettingsEquipmentDto[]> {
  const res = await fetch("/api/settings/equipment", { credentials: "include", cache: "no-store" });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to load equipment"));
  }
  if (!Array.isArray(body)) {
    throw new Error("Invalid equipment response");
  }
  return (body as unknown[]).map(normalizeEquipmentDto);
}

export async function createEquipment(payload: CreateEquipmentPayload): Promise<SettingsEquipmentDto> {
  const res = await fetch("/api/settings/equipment", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to create equipment"));
  }
  return normalizeEquipmentDto(body);
}

export async function updateEquipment(
  id: string,
  payload: UpdateEquipmentPayload,
): Promise<SettingsEquipmentDto> {
  const res = await fetch(`/api/settings/equipment/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to update equipment"));
  }
  return normalizeEquipmentDto(body);
}

export async function deleteEquipment(id: string): Promise<void> {
  const res = await fetch(`/api/settings/equipment/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to delete equipment"));
  }
}

export async function reorderEquipment(itemIds: string[]): Promise<SettingsEquipmentDto[]> {
  const res = await fetch("/api/settings/equipment/reorder", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemIds }),
    cache: "no-store",
  });
  const body = await parseJsonOrEmpty(res);
  if (!res.ok) {
    throw new Error(pickSettingsErrorMessage(body, "Failed to reorder equipment"));
  }
  if (!Array.isArray(body)) {
    throw new Error("Invalid equipment reorder response");
  }
  return (body as unknown[]).map(normalizeEquipmentDto);
}
