import type { Prisma } from "@prisma/client";

import {
  normalizeBusinessHoursConfig,
  recalculateTicketSlaState,
  resolveSlaPolicyMatch,
  type SlaEscalationStep,
  type SlaPolicyShape,
} from "@app-tour/ticketing-core";

import { withTenantRls } from "../db/with-tenant-rls";
import { isPrismaUniqueConstraintError } from "../db/prisma-error-instance";
import { toIso } from "./ticketing-mappers";

export type TicketSlaPolicyRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly workspaceType: string | null;
  readonly categoryCode: string | null;
  readonly priority: string | null;
  readonly queueId: string | null;
  readonly firstResponseMinutes: number;
  readonly nextResponseMinutes: number;
  readonly resolutionMinutes: number;
  readonly businessHoursJson: Readonly<Record<string, unknown>>;
  readonly escalationSteps: readonly SlaEscalationStep[];
  readonly warningThresholdPercent: number;
  readonly enabled: boolean;
  readonly archivedAt: string | null;
  readonly rowVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TicketSlaStateRecord = {
  readonly tenantId: string;
  readonly ticketId: string;
  readonly policyId: string;
  readonly firstResponseDueAt: string | null;
  readonly nextResponseDueAt: string | null;
  readonly resolutionDueAt: string | null;
  readonly firstRespondedAt: string | null;
  readonly lastMemberMessageAt: string | null;
  readonly breachedAt: string | null;
  readonly escalationLevel: number;
  readonly pausedAt: string | null;
  readonly pausedMs: number;
  readonly firstResponseWarningAt: string | null;
  readonly nextResponseWarningAt: string | null;
  readonly resolutionWarningAt: string | null;
};

function mapPolicyRow(row: {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  workspaceType: string | null;
  categoryCode: string | null;
  priority: string | null;
  queueId: string | null;
  firstResponseMinutes: number;
  nextResponseMinutes: number;
  resolutionMinutes: number;
  businessHoursJson: Prisma.JsonValue;
  escalationStepsJson: Prisma.JsonValue;
  warningThresholdPercent: number;
  enabled: boolean;
  archivedAt: Date | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): TicketSlaPolicyRecord {
  const escalationSteps = Array.isArray(row.escalationStepsJson)
    ? (row.escalationStepsJson as SlaEscalationStep[])
    : [];
  const businessHoursJson =
    row.businessHoursJson !== null &&
    typeof row.businessHoursJson === "object" &&
    !Array.isArray(row.businessHoursJson)
      ? (row.businessHoursJson as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    workspaceType: row.workspaceType,
    categoryCode: row.categoryCode,
    priority: row.priority,
    queueId: row.queueId,
    firstResponseMinutes: row.firstResponseMinutes,
    nextResponseMinutes: row.nextResponseMinutes,
    resolutionMinutes: row.resolutionMinutes,
    businessHoursJson,
    escalationSteps,
    warningThresholdPercent: row.warningThresholdPercent,
    enabled: row.enabled,
    archivedAt: row.archivedAt ? toIso(row.archivedAt) : null,
    rowVersion: row.rowVersion,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function toPolicyShape(record: TicketSlaPolicyRecord): SlaPolicyShape {
  return {
    id: record.id,
    code: record.code,
    workspaceType: record.workspaceType,
    categoryCode: record.categoryCode,
    priority: record.priority,
    queueId: record.queueId,
    firstResponseMinutes: record.firstResponseMinutes,
    nextResponseMinutes: record.nextResponseMinutes,
    resolutionMinutes: record.resolutionMinutes,
    businessHours: normalizeBusinessHoursConfig(record.businessHoursJson),
    escalationSteps: record.escalationSteps,
    warningThresholdPercent: record.warningThresholdPercent,
    enabled: record.enabled,
  };
}

function mapStateRow(row: {
  tenantId: string;
  ticketId: string;
  policyId: string;
  firstResponseDueAt: Date | null;
  nextResponseDueAt: Date | null;
  resolutionDueAt: Date | null;
  firstRespondedAt: Date | null;
  lastMemberMessageAt: Date | null;
  breachedAt: Date | null;
  escalationLevel: number;
  pausedAt: Date | null;
  pausedMs: number;
  firstResponseWarningAt: Date | null;
  nextResponseWarningAt: Date | null;
  resolutionWarningAt: Date | null;
}): TicketSlaStateRecord {
  return {
    tenantId: row.tenantId,
    ticketId: row.ticketId,
    policyId: row.policyId,
    firstResponseDueAt: row.firstResponseDueAt ? toIso(row.firstResponseDueAt) : null,
    nextResponseDueAt: row.nextResponseDueAt ? toIso(row.nextResponseDueAt) : null,
    resolutionDueAt: row.resolutionDueAt ? toIso(row.resolutionDueAt) : null,
    firstRespondedAt: row.firstRespondedAt ? toIso(row.firstRespondedAt) : null,
    lastMemberMessageAt: row.lastMemberMessageAt ? toIso(row.lastMemberMessageAt) : null,
    breachedAt: row.breachedAt ? toIso(row.breachedAt) : null,
    escalationLevel: row.escalationLevel,
    pausedAt: row.pausedAt ? toIso(row.pausedAt) : null,
    pausedMs: row.pausedMs,
    firstResponseWarningAt: row.firstResponseWarningAt ? toIso(row.firstResponseWarningAt) : null,
    nextResponseWarningAt: row.nextResponseWarningAt ? toIso(row.nextResponseWarningAt) : null,
    resolutionWarningAt: row.resolutionWarningAt ? toIso(row.resolutionWarningAt) : null,
  };
}

export async function listTicketSlaPolicies(tenantId: string): Promise<readonly TicketSlaPolicyRecord[]> {
  return withTenantRls(tenantId, async (tx) => {
    const rows = await tx.ticketSlaPolicy.findMany({
      where: { tenantId, archivedAt: null },
      orderBy: [{ code: "asc" }],
    });
    return rows.map(mapPolicyRow);
  });
}

export async function findTicketSlaPolicyByCode(
  tenantId: string,
  code: string,
): Promise<TicketSlaPolicyRecord | null> {
  return withTenantRls(tenantId, async (tx) => {
    const row = await tx.ticketSlaPolicy.findFirst({ where: { tenantId, code } });
    return row === null ? null : mapPolicyRow(row);
  });
}

export async function createTicketSlaPolicy(
  tenantId: string,
  input: {
    readonly code: string;
    readonly name: string;
    readonly workspaceType?: string | null;
    readonly categoryCode?: string | null;
    readonly priority?: string | null;
    readonly queueId?: string | null;
    readonly firstResponseMinutes: number;
    readonly nextResponseMinutes: number;
    readonly resolutionMinutes: number;
    readonly businessHoursJson?: Prisma.InputJsonValue;
    readonly escalationStepsJson?: Prisma.InputJsonValue;
    readonly warningThresholdPercent?: number;
    readonly enabled?: boolean;
  },
): Promise<TicketSlaPolicyRecord> {
  return withTenantRls(tenantId, async (tx) => {
    const row = await tx.ticketSlaPolicy.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        workspaceType: input.workspaceType ?? null,
        categoryCode: input.categoryCode ?? null,
        priority: input.priority ?? null,
        queueId: input.queueId ?? null,
        firstResponseMinutes: input.firstResponseMinutes,
        nextResponseMinutes: input.nextResponseMinutes,
        resolutionMinutes: input.resolutionMinutes,
        businessHoursJson: input.businessHoursJson ?? {},
        escalationStepsJson: input.escalationStepsJson ?? [],
        warningThresholdPercent: input.warningThresholdPercent ?? 80,
        enabled: input.enabled ?? true,
      },
    });
    return mapPolicyRow(row);
  });
}

export async function updateTicketSlaPolicy(
  tenantId: string,
  code: string,
  input: {
    readonly name?: string;
    readonly workspaceType?: string | null;
    readonly categoryCode?: string | null;
    readonly priority?: string | null;
    readonly queueId?: string | null;
    readonly firstResponseMinutes?: number;
    readonly nextResponseMinutes?: number;
    readonly resolutionMinutes?: number;
    readonly businessHoursJson?: Prisma.InputJsonValue;
    readonly escalationStepsJson?: Prisma.InputJsonValue;
    readonly warningThresholdPercent?: number;
    readonly enabled?: boolean;
    readonly rowVersion: number;
  },
): Promise<TicketSlaPolicyRecord | null> {
  return withTenantRls(tenantId, async (tx) => {
    const updated = await tx.ticketSlaPolicy.updateMany({
      where: { tenantId, code, rowVersion: input.rowVersion },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.workspaceType !== undefined ? { workspaceType: input.workspaceType } : {}),
        ...(input.categoryCode !== undefined ? { categoryCode: input.categoryCode } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.queueId !== undefined ? { queueId: input.queueId } : {}),
        ...(input.firstResponseMinutes !== undefined
          ? { firstResponseMinutes: input.firstResponseMinutes }
          : {}),
        ...(input.nextResponseMinutes !== undefined
          ? { nextResponseMinutes: input.nextResponseMinutes }
          : {}),
        ...(input.resolutionMinutes !== undefined
          ? { resolutionMinutes: input.resolutionMinutes }
          : {}),
        ...(input.businessHoursJson !== undefined
          ? { businessHoursJson: input.businessHoursJson }
          : {}),
        ...(input.escalationStepsJson !== undefined
          ? { escalationStepsJson: input.escalationStepsJson }
          : {}),
        ...(input.warningThresholdPercent !== undefined
          ? { warningThresholdPercent: input.warningThresholdPercent }
          : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        rowVersion: input.rowVersion + 1,
      },
    });
    if (updated.count !== 1) return null;
    const row = await tx.ticketSlaPolicy.findFirst({ where: { tenantId, code } });
    return row === null ? null : mapPolicyRow(row);
  });
}

export async function listEnabledTicketSlaPolicies(
  tenantId: string,
): Promise<readonly TicketSlaPolicyRecord[]> {
  return withTenantRls(tenantId, async (tx) => {
    const rows = await tx.ticketSlaPolicy.findMany({
      where: { tenantId, enabled: true, archivedAt: null },
    });
    return rows.map(mapPolicyRow);
  });
}

export async function getTicketSlaState(
  tenantId: string,
  ticketId: string,
): Promise<TicketSlaStateRecord | null> {
  return withTenantRls(tenantId, async (tx) => {
    const row = await tx.ticketSlaState.findUnique({
      where: { tenantId_ticketId: { tenantId, ticketId } },
    });
    return row === null ? null : mapStateRow(row);
  });
}

export async function syncTicketSlaStateForTicket(
  tenantId: string,
  ticketId: string,
  context: {
    readonly workspaceType: string;
    readonly categoryCode: string;
    readonly priority: string;
    readonly queueId: string | null;
    readonly status: string;
    readonly createdAt: string;
    readonly onHold: boolean;
    readonly actorUserId?: string | null;
    readonly isMemberPublicMessage?: boolean;
    readonly isOperatorPublicReply?: boolean;
    readonly nowIso: string;
  },
): Promise<TicketSlaStateRecord | null> {
  return withTenantRls(tenantId, async (tx) => {
    const policies = (await tx.ticketSlaPolicy.findMany({
      where: { tenantId, enabled: true, archivedAt: null },
    })).map(mapPolicyRow);
    const matched = resolveSlaPolicyMatch(
      policies.map(toPolicyShape),
      {
        workspaceType: context.workspaceType,
        categoryCode: context.categoryCode,
        priority: context.priority,
        queueId: context.queueId,
      },
    );
    if (matched === null) return null;

    const existing = await tx.ticketSlaState.findUnique({
      where: { tenantId_ticketId: { tenantId, ticketId } },
    });

    let firstRespondedAt = existing?.firstRespondedAt ?? null;
    let lastMemberMessageAt = existing?.lastMemberMessageAt ?? null;
    let pausedAt = existing?.pausedAt ?? null;
    let pausedMs = existing?.pausedMs ?? 0;

    if (context.isMemberPublicMessage === true) {
      lastMemberMessageAt = new Date(context.nowIso);
    }
    if (context.isOperatorPublicReply === true && firstRespondedAt === null) {
      firstRespondedAt = new Date(context.nowIso);
    }

    if (context.onHold && pausedAt === null) {
      pausedAt = new Date(context.nowIso);
    }
    if (!context.onHold && pausedAt !== null) {
      pausedMs += Math.max(0, Date.parse(context.nowIso) - pausedAt.getTime());
      pausedAt = null;
    }

    const recalculated = recalculateTicketSlaState({
      policy: matched,
      ticketCreatedAt: context.createdAt,
      ticketStatus: context.status,
      firstRespondedAt: firstRespondedAt ? toIso(firstRespondedAt) : null,
      lastMemberMessageAt: lastMemberMessageAt ? toIso(lastMemberMessageAt) : null,
      pausedAt: pausedAt ? toIso(pausedAt) : null,
      pausedMs,
      nowIso: context.nowIso,
    });

    const row = await tx.ticketSlaState.upsert({
      where: { tenantId_ticketId: { tenantId, ticketId } },
      create: {
        tenantId,
        ticketId,
        policyId: recalculated.policyId,
        firstResponseDueAt: recalculated.firstResponseDueAt
          ? new Date(recalculated.firstResponseDueAt)
          : null,
        nextResponseDueAt: recalculated.nextResponseDueAt
          ? new Date(recalculated.nextResponseDueAt)
          : null,
        resolutionDueAt: recalculated.resolutionDueAt
          ? new Date(recalculated.resolutionDueAt)
          : null,
        firstRespondedAt,
        lastMemberMessageAt,
        breachedAt: existing?.breachedAt ?? null,
        escalationLevel: existing?.escalationLevel ?? 0,
        pausedAt,
        pausedMs,
        firstResponseWarningAt: existing?.firstResponseWarningAt ?? null,
        nextResponseWarningAt: existing?.nextResponseWarningAt ?? null,
        resolutionWarningAt: existing?.resolutionWarningAt ?? null,
      },
      update: {
        policyId: recalculated.policyId,
        firstResponseDueAt: recalculated.firstResponseDueAt
          ? new Date(recalculated.firstResponseDueAt)
          : null,
        nextResponseDueAt: recalculated.nextResponseDueAt
          ? new Date(recalculated.nextResponseDueAt)
          : null,
        resolutionDueAt: recalculated.resolutionDueAt
          ? new Date(recalculated.resolutionDueAt)
          : null,
        firstRespondedAt,
        lastMemberMessageAt,
        pausedAt,
        pausedMs,
      },
    });
    return mapStateRow(row);
  });
}

export async function tryActivateTicketSlaEscalation(
  tenantId: string,
  ticketId: string,
  escalationLevel: number,
): Promise<boolean> {
  return withTenantRls(tenantId, async (tx) => {
    try {
      await tx.ticketSlaEscalationActivation.create({
        data: { tenantId, ticketId, escalationLevel },
      });
      return true;
    } catch (error: unknown) {
      if (isPrismaUniqueConstraintError(error)) return false;
      throw error;
    }
  });
}

export async function listTicketSlaStatesForProcessing(
  tenantId: string,
  limit: number,
): Promise<readonly TicketSlaStateRecord[]> {
  return withTenantRls(tenantId, async (tx) => {
    const rows = await tx.ticketSlaState.findMany({
      where: {
        tenantId,
        pausedAt: null,
        breachedAt: null,
      },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });
    return rows.map(mapStateRow);
  });
}

export async function markTicketSlaWarning(
  tenantId: string,
  ticketId: string,
  kind: "first" | "next" | "resolution",
  at: string,
): Promise<void> {
  await withTenantRls(tenantId, async (tx) => {
    await tx.ticketSlaState.update({
      where: { tenantId_ticketId: { tenantId, ticketId } },
      data:
        kind === "first"
          ? { firstResponseWarningAt: new Date(at) }
          : kind === "next"
            ? { nextResponseWarningAt: new Date(at) }
            : { resolutionWarningAt: new Date(at) },
    });
  });
}

export async function markTicketSlaBreached(
  tenantId: string,
  ticketId: string,
  at: string,
): Promise<void> {
  await withTenantRls(tenantId, async (tx) => {
    await tx.ticketSlaState.updateMany({
      where: { tenantId, ticketId, breachedAt: null },
      data: { breachedAt: new Date(at) },
    });
  });
}

export async function setTicketSlaEscalationLevel(
  tenantId: string,
  ticketId: string,
  escalationLevel: number,
): Promise<void> {
  await withTenantRls(tenantId, async (tx) => {
    await tx.ticketSlaState.update({
      where: { tenantId_ticketId: { tenantId, ticketId } },
      data: { escalationLevel },
    });
  });
}

export function toTicketSlaPolicyHttp(record: TicketSlaPolicyRecord): Record<string, unknown> {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    workspaceType: record.workspaceType,
    categoryCode: record.categoryCode,
    priority: record.priority,
    queueId: record.queueId,
    firstResponseMinutes: record.firstResponseMinutes,
    nextResponseMinutes: record.nextResponseMinutes,
    resolutionMinutes: record.resolutionMinutes,
    businessHours: record.businessHoursJson,
    escalationSteps: record.escalationSteps,
    warningThresholdPercent: record.warningThresholdPercent,
    enabled: record.enabled,
    rowVersion: record.rowVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toTicketSlaStateHttp(record: TicketSlaStateRecord): Record<string, unknown> {
  return {
    policyId: record.policyId,
    firstResponseDueAt: record.firstResponseDueAt,
    nextResponseDueAt: record.nextResponseDueAt,
    resolutionDueAt: record.resolutionDueAt,
    firstRespondedAt: record.firstRespondedAt,
    lastMemberMessageAt: record.lastMemberMessageAt,
    breachedAt: record.breachedAt,
    escalationLevel: record.escalationLevel,
    pausedAt: record.pausedAt,
    pausedMs: record.pausedMs,
    firstResponseWarningAt: record.firstResponseWarningAt,
    nextResponseWarningAt: record.nextResponseWarningAt,
    resolutionWarningAt: record.resolutionWarningAt,
  };
}
