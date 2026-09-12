import { getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { logger } from "../observability/logger";
import { removeTicketAttachmentObject } from "./ticket-attachment-storage";

export type ProcessTicketOrphanAttachmentsResult = {
  readonly tenantsScanned: number;
  readonly expiredIntentsRemoved: number;
  readonly orphanObjectsRemoved: number;
};

function isWorkerEnabled(): boolean {
  const raw = process.env.TICKETING_ORPHAN_ATTACHMENT_WORKER_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export async function processTicketOrphanAttachmentsOnce(
  batchPerTenant = 50,
): Promise<ProcessTicketOrphanAttachmentsResult> {
  if (!isWorkerEnabled()) {
    return { tenantsScanned: 0, expiredIntentsRemoved: 0, orphanObjectsRemoved: 0 };
  }

  const admin = getPrismaAdmin();
  const tenants = await admin.tenant.findMany({
    where: { status: "active" },
    select: { id: true },
  });
  const now = new Date();
  let expiredIntentsRemoved = 0;
  let orphanObjectsRemoved = 0;

  for (const tenant of tenants) {
    const expiredIntents = await withTenantRls(tenant.id, async (tx) =>
      tx.ticketAttachment.findMany({
        where: {
          tenantId: tenant.id,
          uploadedAt: null,
          uploadIntentExpiresAt: { lt: now },
        },
        select: { id: true, objectKey: true },
        take: batchPerTenant,
      }),
    );

    for (const intent of expiredIntents) {
      try {
        await removeTicketAttachmentObject({
          tenantId: tenant.id,
          storageKey: intent.objectKey,
        });
        orphanObjectsRemoved += 1;
      } catch {
        // storage may be unavailable or object absent
      }
      await withTenantRls(tenant.id, async (tx) =>
        tx.ticketAttachment.deleteMany({
          where: { tenantId: tenant.id, id: intent.id },
        }),
      );
      expiredIntentsRemoved += 1;
    }
  }

  if (expiredIntentsRemoved > 0 || orphanObjectsRemoved > 0) {
    logger.info(
      {
        event: "ticketing.orphan_attachments.tick",
        tenantsScanned: tenants.length,
        expiredIntentsRemoved,
        orphanObjectsRemoved,
      },
      "ticketing orphan attachment worker tick",
    );
  }

  return {
    tenantsScanned: tenants.length,
    expiredIntentsRemoved,
    orphanObjectsRemoved,
  };
}

export function startTicketOrphanAttachmentWorkerIfEnabled(): {
  readonly stop: () => Promise<void>;
} {
  if (!isWorkerEnabled()) {
    return { stop: async () => {} };
  }

  const intervalMs = Number.parseInt(
    process.env.TICKETING_ORPHAN_ATTACHMENT_POLL_INTERVAL_MS ?? "3600000",
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
    inFlight = processTicketOrphanAttachmentsOnce()
      .then(() => undefined)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ event: "ticketing.orphan_attachments.tick.failed", err: message });
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
