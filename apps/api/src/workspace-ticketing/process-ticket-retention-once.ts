import { getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { logger } from "../observability/logger";
import { removeTicketAttachmentObject } from "./ticket-attachment-storage";
import {
  retentionCutoffIso,
  resolveTicketRetentionPolicy,
} from "./ticket-retention-policy";

export type ProcessTicketRetentionResult = {
  readonly tenantsScanned: number;
  readonly ticketsPurged: number;
  readonly attachmentsPurged: number;
};

function isWorkerEnabled(): boolean {
  const raw = process.env.TICKETING_RETENTION_WORKER_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export async function processTicketRetentionOnce(
  batchPerTenant = 50,
): Promise<ProcessTicketRetentionResult> {
  if (!isWorkerEnabled()) {
    return { tenantsScanned: 0, ticketsPurged: 0, attachmentsPurged: 0 };
  }

  const admin = getPrismaAdmin();
  const tenants = await admin.tenant.findMany({
    where: { status: "active" },
    select: { id: true },
  });

  let ticketsPurged = 0;
  let attachmentsPurged = 0;

  for (const tenant of tenants) {
    const policy = await resolveTicketRetentionPolicy(tenant.id);
    const ticketCutoff = retentionCutoffIso(policy.retentionDays);
    const attachmentCutoff = retentionCutoffIso(policy.attachmentRetentionDays);

    const expiredAttachments = await withTenantRls(tenant.id, async (tx) =>
      tx.ticketAttachment.findMany({
        where: {
          tenantId: tenant.id,
          deletedAt: { not: null, lt: new Date(attachmentCutoff) },
        },
        select: { id: true, objectKey: true },
        take: batchPerTenant,
      }),
    );

    for (const attachment of expiredAttachments) {
      try {
        await removeTicketAttachmentObject({
          tenantId: tenant.id,
          storageKey: attachment.objectKey,
        });
      } catch {
        // object may already be gone
      }
      await withTenantRls(tenant.id, async (tx) =>
        tx.ticketAttachment.deleteMany({
          where: { tenantId: tenant.id, id: attachment.id },
        }),
      );
      attachmentsPurged += 1;
    }

    const staleClosedTickets = await withTenantRls(tenant.id, async (tx) =>
      tx.ticket.findMany({
        where: {
          tenantId: tenant.id,
          status: "closed",
          OR: [
            { closedAt: { lt: new Date(ticketCutoff) } },
            {
              closedAt: null,
              updatedAt: { lt: new Date(ticketCutoff) },
            },
          ],
        },
        select: { id: true },
        take: batchPerTenant,
      }),
    );

    if (staleClosedTickets.length > 0) {
      const ids = staleClosedTickets.map((ticket) => ticket.id);
      const deleted = await withTenantRls(tenant.id, async (tx) =>
        tx.ticket.deleteMany({
          where: { tenantId: tenant.id, id: { in: ids } },
        }),
      );
      ticketsPurged += deleted.count;
    }
  }

  if (ticketsPurged > 0 || attachmentsPurged > 0) {
    logger.info(
      {
        event: "ticketing.retention.tick",
        tenantsScanned: tenants.length,
        ticketsPurged,
        attachmentsPurged,
      },
      "ticketing retention worker tick",
    );
  }

  return {
    tenantsScanned: tenants.length,
    ticketsPurged,
    attachmentsPurged,
  };
}

export function startTicketRetentionWorkerIfEnabled(): { readonly stop: () => Promise<void> } {
  if (!isWorkerEnabled()) {
    return { stop: async () => {} };
  }

  const intervalMs = Number.parseInt(
    process.env.TICKETING_RETENTION_POLL_INTERVAL_MS ?? "3600000",
    10,
  );
  let stopped = false;
  let running = false;
  let inFlight: Promise<void> | undefined;
  let timer: NodeJS.Timeout | undefined;

  const schedule = (): void => {
    if (stopped) return;
    timer = setTimeout(() => void runTick(), intervalMs);
    timer.unref?.();
  };

  const runTick = async (): Promise<void> => {
    if (stopped || running) {
      schedule();
      return;
    }
    running = true;
    inFlight = processTicketRetentionOnce()
      .then(() => undefined)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ event: "ticketing.retention.tick.failed", err: message });
      })
      .finally(() => {
        running = false;
        schedule();
      });
    await inFlight;
  };

  void runTick();
  return {
    stop: async () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      if (inFlight !== undefined) await inFlight;
    },
  };
}
