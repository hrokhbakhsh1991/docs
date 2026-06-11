const CURSOR_PREFIX = "v1:" as const;

export function encodeUsersDirectoryCursor(offset: number): string {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error("CURSOR_OFFSET_INVALID");
  }
  return `${CURSOR_PREFIX}${offset}`;
}

export function decodeUsersDirectoryCursor(cursor: string | undefined): number {
  if (cursor === undefined || cursor.trim().length === 0) {
    return 0;
  }
  const trimmed = cursor.trim();
  if (!trimmed.startsWith(CURSOR_PREFIX)) {
    return 0;
  }
  const raw = Number(trimmed.slice(CURSOR_PREFIX.length));
  return Number.isInteger(raw) && raw >= 0 ? raw : 0;
}
