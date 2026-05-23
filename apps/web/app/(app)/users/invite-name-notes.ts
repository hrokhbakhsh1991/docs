const STORAGE_KEY = "users-invite-name-notes";

type NotesMap = Record<string, string>;

function readMap(): NotesMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed as NotesMap;
  } catch {
    return {};
  }
}

function writeMap(map: NotesMap): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getInviteNameNote(key: string): string | null {
  const note = readMap()[key]?.trim();
  return note && note.length > 0 ? note : null;
}

export function setInviteNameNoteForPhone(phone: string, note: string): void {
  const trimmed = note.trim();
  if (!trimmed) {
    return;
  }
  const map = readMap();
  map[`phone:${phone.trim()}`] = trimmed;
  writeMap(map);
}

export function migrateInviteNameNotePhoneToInviteId(
  phone: string,
  inviteId: string
): void {
  const map = readMap();
  const phoneKey = `phone:${phone.trim()}`;
  const existing = map[phoneKey]?.trim();
  if (existing) {
    map[`invite:${inviteId}`] = existing;
    delete map[phoneKey];
    writeMap(map);
  }
}

export function getInviteDisplayNote(inviteId: string, phone: string): string | null {
  return getInviteNameNote(`invite:${inviteId}`) ?? getInviteNameNote(`phone:${phone.trim()}`);
}
