import type { Prisma } from "@prisma/client";

import { withTenantRls } from "../db/with-tenant-rls";

export const MAX_TICKET_REPORT_WINDOW_DAYS = 365;
export const DEFAULT_TICKET_REPORT_WINDOW_DAYS = 90;
export const MAX_TICKET_REPORT_EXPORT_ROWS = 5000;
export const TICKET_REPORT_CACHE_TTL_MS = 60_000;

export type TicketReportWindow = {
  readonly from: Date;
  readonly to: Date;
};

export type TicketReportSummary = {
  readonly ticketCount: number;
  readonly statusDistribution: Readonly<Record<string, number>>;
  readonly avgFirstResponseSeconds: number | null;
  readonly avgResolutionSeconds: number | null;
  readonly slaBreachCount: number;
  readonly byCategory: readonly {
    readonly code: string;
    readonly count: number;
    readonly avgResolutionSeconds: number | null;
  }[];
  readonly byQueue: readonly {
    readonly queueId: string | null;
    readonly code: string | null;
    readonly count: number;
  }[];
  readonly byTeam: readonly {
    readonly teamId: string | null;
    readonly code: string | null;
    readonly count: number;
  }[];
  readonly window: { readonly from: string; readonly to: string };
};

const reportCache = new Map<string, { readonly expiresAt: number; readonly summary: TicketReportSummary }>();

export function buildTicketReportCacheKey(tenantId: string, fromIso: string, toIso: string): string {
  return `${tenantId}::${fromIso}::${toIso}`;
}

export function readTicketReportCache(key: string): TicketReportSummary | null {
  const entry = reportCache.get(key);
  if (entry === undefined) return null;
  if (Date.now() > entry.expiresAt) {
    reportCache.delete(key);
    return null;
  }
  return entry.summary;
}

export function writeTicketReportCache(key: string, summary: TicketReportSummary): void {
  reportCache.set(key, { expiresAt: Date.now() + TICKET_REPORT_CACHE_TTL_MS, summary });
}

export function clearTicketReportCacheForTests(): void {
  reportCache.clear();
}

export function parseTicketReportWindow(input: {
  readonly from?: string | null;
  readonly to?: string | null;
}): TicketReportWindow {
  const now = new Date();
  const to = input.to ? new Date(input.to) : now;
  const from = input.from
    ? new Date(input.from)
    : new Date(to.getTime() - DEFAULT_TICKET_REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new Error("INVALID_REPORT_WINDOW");
  }
  const maxSpanMs = MAX_TICKET_REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxSpanMs) {
    throw new Error("INVALID_REPORT_WINDOW");
  }
  return { from, to };
}

function avgSeconds(rows: readonly { readonly seconds: number | null }[]): number | null {
  const values = rows.map((row) => row.seconds).filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function getTicketReportSummary(
  tenantId: string,
  window: TicketReportWindow,
): Promise<TicketReportSummary> {
  const cacheKey = buildTicketReportCacheKey(
    tenantId,
    window.from.toISOString(),
    window.to.toISOString(),
  );
  const cached = readTicketReportCache(cacheKey);
  if (cached !== null) return cached;

  return withTenantRls(tenantId, async (tx) => {
    const where: Prisma.TicketWhereInput = {
      tenantId,
      createdAt: { gte: window.from, lte: window.to },
    };

    const ticketCount = await tx.ticket.count({ where });
    const statusGroups = await tx.ticket.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });
    const statusDistribution = Object.fromEntries(
      statusGroups.map((row) => [row.status, row._count._all]),
    );

    const slaRows = await tx.ticketSlaState.findMany({
      where: {
        tenantId,
        ticket: { createdAt: { gte: window.from, lte: window.to } },
      },
      select: {
        firstRespondedAt: true,
        breachedAt: true,
        ticket: { select: { createdAt: true, resolvedAt: true } },
      },
      take: 10_000,
    });

    const firstResponseSamples = slaRows
      .filter((row) => row.firstRespondedAt !== null)
      .map((row) => ({
        seconds:
          row.firstRespondedAt === null
            ? null
            : (row.firstRespondedAt.getTime() - row.ticket.createdAt.getTime()) / 1000,
      }));
    const resolutionSamples = await tx.ticket.findMany({
      where: { ...where, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 10_000,
    });
    const resolutionSeconds = resolutionSamples.map((row) => ({
      seconds:
        row.resolvedAt === null
          ? null
          : (row.resolvedAt.getTime() - row.createdAt.getTime()) / 1000,
    }));

    const slaBreachCount = await tx.ticketSlaState.count({
      where: {
        tenantId,
        breachedAt: { not: null },
        ticket: { createdAt: { gte: window.from, lte: window.to } },
      },
    });

    const categoryGroups = await tx.ticket.groupBy({
      by: ["categoryCode"],
      where,
      _count: { _all: true },
    });
    const byCategory = await Promise.all(
      categoryGroups.map(async (row) => {
        const resolved = await tx.ticket.findMany({
          where: {
            tenantId,
            categoryCode: row.categoryCode,
            createdAt: { gte: window.from, lte: window.to },
            resolvedAt: { not: null },
          },
          select: { createdAt: true, resolvedAt: true },
          take: 1000,
        });
        return {
          code: row.categoryCode,
          count: row._count._all,
          avgResolutionSeconds: avgSeconds(
            resolved.map((ticket) => ({
              seconds:
                ticket.resolvedAt === null
                  ? null
                  : (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / 1000,
            })),
          ),
        };
      }),
    );

    const queueGroups = await tx.ticket.groupBy({
      by: ["queueId"],
      where,
      _count: { _all: true },
    });
    const queueIds = queueGroups
      .map((row) => row.queueId)
      .filter((id): id is string => id !== null);
    const queues =
      queueIds.length === 0
        ? []
        : await tx.ticketQueue.findMany({
            where: { tenantId, id: { in: queueIds } },
            select: { id: true, code: true },
          });
    const queueCodeById = new Map(queues.map((queue) => [queue.id, queue.code]));
    const byQueue = queueGroups.map((row) => ({
      queueId: row.queueId,
      code: row.queueId === null ? null : (queueCodeById.get(row.queueId) ?? null),
      count: row._count._all,
    }));

    const teamGroups = await tx.ticket.groupBy({
      by: ["assigneeTeamId"],
      where,
      _count: { _all: true },
    });
    const teamIds = teamGroups
      .map((row) => row.assigneeTeamId)
      .filter((id): id is string => id !== null);
    const teams =
      teamIds.length === 0
        ? []
        : await tx.ticketTeam.findMany({
            where: { tenantId, id: { in: teamIds } },
            select: { id: true, code: true },
          });
    const teamCodeById = new Map(teams.map((team) => [team.id, team.code]));
    const byTeam = teamGroups.map((row) => ({
      teamId: row.assigneeTeamId,
      code: row.assigneeTeamId === null ? null : (teamCodeById.get(row.assigneeTeamId) ?? null),
      count: row._count._all,
    }));

    const summary: TicketReportSummary = {
      ticketCount,
      statusDistribution,
      avgFirstResponseSeconds: avgSeconds(firstResponseSamples),
      avgResolutionSeconds: avgSeconds(resolutionSeconds),
      slaBreachCount,
      byCategory,
      byQueue,
      byTeam,
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
    };
    writeTicketReportCache(cacheKey, summary);
    return summary;
  });
}

export async function exportTicketReportRows(
  tenantId: string,
  window: TicketReportWindow,
  limit: number,
): Promise<readonly Record<string, unknown>[]> {
  const boundedLimit = Math.min(Math.max(limit, 1), MAX_TICKET_REPORT_EXPORT_ROWS);
  return withTenantRls(tenantId, async (tx) => {
    const rows = await tx.ticket.findMany({
      where: {
        tenantId,
        createdAt: { gte: window.from, lte: window.to },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: boundedLimit,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        status: true,
        priority: true,
        categoryCode: true,
        requesterUserId: true,
        assigneeUserId: true,
        assigneeTeamId: true,
        queueId: true,
        createdAt: true,
        resolvedAt: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      ticketCode: `TKT-${String(row.ticketNumber).padStart(6, "0")}`,
      subject: row.subject,
      status: row.status,
      priority: row.priority,
      categoryCode: row.categoryCode,
      requesterUserId: row.requesterUserId,
      assigneeUserId: row.assigneeUserId,
      assigneeTeamId: row.assigneeTeamId,
      queueId: row.queueId,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    }));
  });
}
