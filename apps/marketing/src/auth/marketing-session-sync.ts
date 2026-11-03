export const SESSION_SYNC_INTERVAL_MS = 3_000;

export function parsePortalSessionProbe(value: unknown): boolean | null {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return record.ok === true && typeof record.ready === "boolean" ? record.ready : null;
}
