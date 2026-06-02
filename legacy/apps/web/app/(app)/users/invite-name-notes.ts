import {
  createScopedSessionStorage,
  resolveStorageTenantId,
} from "@/lib/storage/scoped-storage";

const STORAGE_NAMESPACE = "users";
const LOGICAL_KEY = "invite-name-notes";

type NotesMap = Record<string, string>;

function sessionForTenant(tenantId: string) {
  return createScopedSessionStorage(
    STORAGE_NAMESPACE,
    resolveStorageTenantId({ tenantId }),
  );
}

function legacyStorageKey(tenantId: string): string {
  const scoped = tenantId.trim();
  return scoped ? `users-invite-name-notes:${scoped}` : "users-invite-name-notes";
}

function readMap(tenantId: string): NotesMap {
  if (typeof window === "undefined") {
    return {};
  }
  const storage = sessionForTenant(tenantId);
  const raw =
    storage.migrateLegacyItem(LOGICAL_KEY, legacyStorageKey(tenantId)) ??
    storage.getItem(LOGICAL_KEY);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed as NotesMap;
  } catch {
    return {};
  }
}

function writeMap(tenantId: string, map: NotesMap): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionForTenant(tenantId).setJson(LOGICAL_KEY, map);
}

export function getInviteNameNote(tenantId: string, key: string): string | null {
  const note = readMap(tenantId)[key]?.trim();
  return note && note.length > 0 ? note : null;
}

export function setInviteNameNoteForPhone(tenantId: string, phone: string, note: string): void {
  const trimmed = note.trim();
  if (!trimmed) {
    return;
  }
  const map = readMap(tenantId);
  map[`phone:${phone.trim()}`] = trimmed;
  writeMap(tenantId, map);
}

export function migrateInviteNameNotePhoneToInviteId(
  tenantId: string,
  phone: string,
  inviteId: string,
): void {
  const map = readMap(tenantId);
  const phoneKey = `phone:${phone.trim()}`;
  const existing = map[phoneKey]?.trim();
  if (existing) {
    map[`invite:${inviteId}`] = existing;
    delete map[phoneKey];
    writeMap(tenantId, map);
  }
}

export function getInviteDisplayNote(tenantId: string, inviteId: string, phone: string): string | null {
  return (
    getInviteNameNote(tenantId, `invite:${inviteId}`) ??
    getInviteNameNote(tenantId, `phone:${phone.trim()}`)
  );
}
