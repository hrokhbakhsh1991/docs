/**
 * Primary resource touched by the event (optional for pure auth/session events).
 */
export type AuditResource = {
  type: string;
  id?: string | null;
};
