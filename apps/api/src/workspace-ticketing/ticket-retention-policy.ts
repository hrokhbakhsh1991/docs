import { withTenantRls } from "../db/with-tenant-rls";

/** Default ~7 years for closed ticket purge (audit-friendly). */
export const DEFAULT_TICKET_RETENTION_DAYS = 2555;

/** Default 2 years for soft-deleted attachment purge. */
export const DEFAULT_ATTACHMENT_RETENTION_DAYS = 730;

export type TicketRetentionPolicy = {
  readonly retentionDays: number;
  readonly attachmentRetentionDays: number;
};

function readPositiveInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

export async function resolveTicketRetentionPolicy(
  tenantId: string,
): Promise<TicketRetentionPolicy> {
  const row = await withTenantRls(tenantId, async (tx) =>
    tx.ticketWorkspaceSettings.findUnique({
      where: { tenantId },
      select: { slaDefaults: true },
    }),
  );
  const defaults =
    row?.slaDefaults !== null &&
    typeof row?.slaDefaults === "object" &&
    !Array.isArray(row?.slaDefaults)
      ? (row.slaDefaults as Record<string, unknown>)
      : {};

  return {
    retentionDays: readPositiveInt(defaults.retentionDays, DEFAULT_TICKET_RETENTION_DAYS),
    attachmentRetentionDays: readPositiveInt(
      defaults.attachmentRetentionDays,
      DEFAULT_ATTACHMENT_RETENTION_DAYS,
    ),
  };
}

export function retentionCutoffIso(retentionDays: number, now = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return cutoff.toISOString();
}
