import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import { DENALI_REMINDER_OFFSETS } from "./workspace-exposure-host-bindings.generated.ts";

import { getPrisma } from "../db/prisma";
import { logger } from "../observability/logger";

import { upsertDenaliReminderActivation } from "./denali-reminder-activation.repository";

const SCHEDULER_LOOKAHEAD_MS = 49 * 60 * 60 * 1000;
const SCHEDULER_GRACE_MS = 5 * 60 * 1000;

function readStartDateTime(canonical: CanonicalDocument): Date | null {
  const data = canonical.data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const raw = (data as Record<string, unknown>).startDateTime;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function isPublished(canonical: CanonicalDocument): boolean {
  const data = canonical.data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }
  return (data as Record<string, unknown>).publishStatus === "active";
}

function parseReminderOffsetMs(offset: string): number | null {
  const match = /^-(\d+)h$/.exec(offset);
  if (match === null) {
    return null;
  }
  const hours = Number.parseInt(match[1]!, 10);
  return Number.isFinite(hours) ? hours * 60 * 60 * 1000 : null;
}

function isReminderDue(now: Date, startAt: Date, offset: string): boolean {
  const offsetMs = parseReminderOffsetMs(offset);
  if (offsetMs === null) {
    return false;
  }
  const dueAt = new Date(startAt.getTime() - offsetMs);
  return now.getTime() + SCHEDULER_GRACE_MS >= dueAt.getTime() && now.getTime() < startAt.getTime();
}

export type ProcessDenaliExposureReminderSchedulerResult = {
  readonly tenantsScanned: number;
  readonly toursScanned: number;
  readonly activationsCreated: number;
};

export async function processDenaliExposureReminderSchedulerOnce(): Promise<ProcessDenaliExposureReminderSchedulerResult> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + SCHEDULER_LOOKAHEAD_MS);

  const prisma = getPrisma();
  const tenants = await prisma.tenant.findMany({
    where: { workspaceType: "denali", status: "active" },
    select: { id: true },
  });

  let toursScanned = 0;
  let activationsCreated = 0;

  for (const tenant of tenants) {
    const tours = await prisma.tour.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, canonical: true },
    });

    for (const tour of tours) {
      const canonical = tour.canonical as unknown as CanonicalDocument;
      if (!isPublished(canonical)) {
        continue;
      }
      const startAt = readStartDateTime(canonical);
      if (startAt === null || startAt.getTime() > windowEnd.getTime()) {
        continue;
      }
      toursScanned += 1;

      for (const offset of DENALI_REMINDER_OFFSETS) {
        if (!isReminderDue(now, startAt, offset)) {
          continue;
        }
        const inserted = await upsertDenaliReminderActivation({
          tenantId: tenant.id,
          tourId: tour.id,
          reminderOffset: offset,
          anchorAt: startAt,
        });
        if (inserted) {
          activationsCreated += 1;
        }
      }
    }
  }

  return {
    tenantsScanned: tenants.length,
    toursScanned,
    activationsCreated,
  };
}

export function isDenaliExposureReminderSchedulerEnabled(): boolean {
  return process.env.DENALI_EXPOSURE_REMINDER_SCHEDULER_ENABLED?.trim().toLowerCase() === "true";
}

export function readDenaliExposureReminderSchedulerPollIntervalMs(): number {
  const raw = process.env.DENALI_EXPOSURE_REMINDER_SCHEDULER_POLL_MS?.trim();
  const parsed = raw === undefined ? 60_000 : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return 60_000;
  }
  return Math.max(parsed, 5_000);
}

export type DenaliExposureReminderSchedulerHandle = {
  readonly stop: () => Promise<void>;
};

export function startDenaliExposureReminderSchedulerIfEnabled(): DenaliExposureReminderSchedulerHandle {
  if (!isDenaliExposureReminderSchedulerEnabled()) {
    return { stop: async () => {} };
  }

  const intervalMs = readDenaliExposureReminderSchedulerPollIntervalMs();
  let stopped = false;
  let running = false;
  let inFlight: Promise<void> | undefined;
  let timer: NodeJS.Timeout | undefined;

  const schedule = (): void => {
    if (stopped) {
      return;
    }
    timer = setTimeout(() => {
      void runTick();
    }, intervalMs);
    timer.unref?.();
  };

  const runTick = async (): Promise<void> => {
    if (stopped || running) {
      schedule();
      return;
    }
    running = true;
    inFlight = processDenaliExposureReminderSchedulerOnce()
      .then((result) => {
        if (result.activationsCreated > 0) {
          logger.info(
            { event: "denali.exposure.reminder.tick", ...result },
            "denali exposure reminder scheduler tick",
          );
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ event: "denali.exposure.reminder.tick.failed", err: message });
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
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      if (inFlight !== undefined) {
        await inFlight;
      }
    },
  };
}
