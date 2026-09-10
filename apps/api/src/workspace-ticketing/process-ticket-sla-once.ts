import {
  addBusinessMinutes,
  computeSlaWarningAt,
  isSlaDue,
  isSlaWarningDue,
  normalizeBusinessHoursConfig,
  type SlaEscalationStep,
} from "@app-tour/ticketing-core";

import { getPrismaAdmin } from "../db/prisma";
import { enqueueOutboxEvent } from "../outbox/enqueue-domain-event";
import type { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";
import { logger } from "../observability/logger";
import {
  listTicketSlaStatesForProcessing,
  markTicketSlaBreached,
  markTicketSlaWarning,
  setTicketSlaEscalationLevel,
  tryActivateTicketSlaEscalation,
  type TicketSlaStateRecord,
} from "../workspace-ticketing/ticket-sla.repository";

export type ProcessTicketSlaResult = {
  readonly tenantsScanned: number;
  readonly statesScanned: number;
  readonly warnings: number;
  readonly breaches: number;
  readonly escalations: number;
};

function isWorkerEnabled(): boolean {
  const raw = process.env.TICKETING_SLA_WORKER_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

async function enqueueSlaOutboxEvent(
  tenantId: string,
  ticketId: string,
  eventType: string,
  domainEventId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  return withTenantRls(tenantId, async (tx) =>
    enqueueOutboxEvent(tx, {
      tenantId,
      aggregateType: "ticket",
      aggregateId: ticketId,
      eventType,
      domainEventId,
      payload: payload as Prisma.InputJsonValue,
    }),
  );
}

async function processState(
  tenantId: string,
  state: TicketSlaStateRecord,
  policy: {
    warningThresholdPercent: number;
    escalationStepsJson: unknown;
    businessHoursJson: unknown;
    firstResponseMinutes: number;
  },
  ticketCreatedAt: string,
  nowIso: string,
): Promise<{ warnings: number; breaches: number; escalations: number }> {
  let warnings = 0;
  let breaches = 0;
  let escalations = 0;

  const businessHours = normalizeBusinessHoursConfig(
    policy.businessHoursJson !== null &&
      typeof policy.businessHoursJson === "object" &&
      !Array.isArray(policy.businessHoursJson)
      ? (policy.businessHoursJson as Record<string, unknown>)
      : {},
  );

  const clocks: Array<{
    kind: "first" | "next" | "resolution";
    anchor: string | null;
    due: string | null;
    warningAt: string | null;
  }> = [
    {
      kind: "first",
      anchor: ticketCreatedAt,
      due: state.firstResponseDueAt,
      warningAt: state.firstResponseWarningAt,
    },
    {
      kind: "next",
      anchor: state.lastMemberMessageAt,
      due: state.nextResponseDueAt,
      warningAt: state.nextResponseWarningAt,
    },
    {
      kind: "resolution",
      anchor: ticketCreatedAt,
      due: state.resolutionDueAt,
      warningAt: state.resolutionWarningAt,
    },
  ];

  for (const clock of clocks) {
    if (clock.due === null || clock.anchor === null) continue;
    if (
      isSlaWarningDue(
        clock.anchor,
        clock.due,
        policy.warningThresholdPercent,
        nowIso,
        clock.warningAt,
      )
    ) {
      const inserted = await enqueueSlaOutboxEvent(
        tenantId,
        state.ticketId,
        "ticket.sla.warning",
        `sla-warning:${state.ticketId}:${clock.kind}`,
        { ticketId: state.ticketId, clock: clock.kind, dueAt: clock.due },
      );
      if (inserted) {
        await markTicketSlaWarning(tenantId, state.ticketId, clock.kind, nowIso);
        warnings += 1;
      }
    }
    if (isSlaDue(clock.due, nowIso) && state.breachedAt === null) {
      const inserted = await enqueueSlaOutboxEvent(
        tenantId,
        state.ticketId,
        "ticket.sla.breached",
        `sla-breach:${state.ticketId}:${clock.kind}`,
        { ticketId: state.ticketId, clock: clock.kind, dueAt: clock.due },
      );
      if (inserted) {
        await markTicketSlaBreached(tenantId, state.ticketId, nowIso);
        breaches += 1;
      }
    }
    void computeSlaWarningAt;
  }

  const steps = Array.isArray(policy.escalationStepsJson)
    ? (policy.escalationStepsJson as SlaEscalationStep[])
    : [];
  for (const step of steps) {
    if (step.level <= state.escalationLevel) continue;
    const dueAt = addBusinessMinutes(ticketCreatedAt, step.afterMinutes, businessHours);
    if (!isSlaDue(dueAt, nowIso)) continue;
    const activated = await tryActivateTicketSlaEscalation(tenantId, state.ticketId, step.level);
    if (!activated) continue;
    const inserted = await enqueueSlaOutboxEvent(
      tenantId,
      state.ticketId,
      "ticket.sla.escalated",
      `sla-escalation:${state.ticketId}:${step.level}`,
      {
        ticketId: state.ticketId,
        escalationLevel: step.level,
        action: step.action,
        teamId: step.teamId ?? null,
        priority: step.priority ?? null,
      },
    );
    if (inserted) {
      await setTicketSlaEscalationLevel(tenantId, state.ticketId, step.level);
      escalations += 1;
    }
  }

  return { warnings, breaches, escalations };
}

export async function processTicketSlaOnce(batchPerTenant = 50): Promise<ProcessTicketSlaResult> {
  if (!isWorkerEnabled()) {
    return { tenantsScanned: 0, statesScanned: 0, warnings: 0, breaches: 0, escalations: 0 };
  }

  const admin = getPrismaAdmin();
  const tenants = await admin.tenant.findMany({
    where: { status: "active" },
    select: { id: true },
  });
  const nowIso = new Date().toISOString();
  let statesScanned = 0;
  let warnings = 0;
  let breaches = 0;
  let escalations = 0;

  for (const tenant of tenants) {
    const states = await listTicketSlaStatesForProcessing(tenant.id, batchPerTenant);
    if (states.length === 0) continue;

    const policies = await withTenantRls(tenant.id, async (tx) =>
      tx.ticketSlaPolicy.findMany({
        where: { tenantId: tenant.id, enabled: true, archivedAt: null },
      }),
    );
    const policyById = new Map(policies.map((policy) => [policy.id, policy]));
    const ticketIds = states.map((state) => state.ticketId);
    const tickets = await withTenantRls(tenant.id, async (tx) =>
      tx.ticket.findMany({
        where: { tenantId: tenant.id, id: { in: ticketIds } },
        select: { id: true, createdAt: true, subject: true },
      }),
    );
    const ticketById = new Map(
      tickets.map((ticket) => [ticket.id, ticket.createdAt.toISOString()]),
    );

    for (const state of states) {
      statesScanned += 1;
      const policy = policyById.get(state.policyId);
      const ticketCreatedAt = ticketById.get(state.ticketId);
      if (policy === undefined || ticketCreatedAt === undefined) continue;
      const result = await processState(
        tenant.id,
        state,
        {
          warningThresholdPercent: policy.warningThresholdPercent,
          escalationStepsJson: policy.escalationStepsJson,
          businessHoursJson: policy.businessHoursJson,
          firstResponseMinutes: policy.firstResponseMinutes,
        },
        ticketCreatedAt,
        nowIso,
      );
      warnings += result.warnings;
      breaches += result.breaches;
      escalations += result.escalations;
    }
  }

  if (statesScanned > 0) {
    logger.info(
      {
        event: "ticketing.sla.tick",
        tenantsScanned: tenants.length,
        statesScanned,
        warnings,
        breaches,
        escalations,
      },
      "ticketing SLA worker tick",
    );
  }

  return {
    tenantsScanned: tenants.length,
    statesScanned,
    warnings,
    breaches,
    escalations,
  };
}

export function startTicketSlaWorkerIfEnabled(): { readonly stop: () => Promise<void> } {
  if (!isWorkerEnabled()) {
    return { stop: async () => {} };
  }

  const intervalMs = Number.parseInt(process.env.TICKETING_SLA_POLL_INTERVAL_MS ?? "30000", 10);
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
    inFlight = processTicketSlaOnce()
      .then(() => undefined)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ event: "ticketing.sla.tick.failed", err: message });
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
