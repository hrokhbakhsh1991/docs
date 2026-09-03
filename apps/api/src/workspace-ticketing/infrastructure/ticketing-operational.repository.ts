import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { withTenantRls } from "../../db/with-tenant-rls";
import { toIso } from "../ticketing-mappers";

export type TicketTagRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly label: string;
  readonly colorToken: string | null;
  readonly archivedAt: string | null;
  readonly rowVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TicketQueueRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly enabled: boolean;
  readonly sortOrder: number;
  readonly filterJson: Readonly<Record<string, unknown>>;
  readonly teamId: string | null;
  readonly teamCode: string | null;
  readonly isDefault: boolean;
  readonly archivedAt: string | null;
  readonly rowVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type TicketTeamRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly enabled: boolean;
  readonly isDefault: boolean;
  readonly archivedAt: string | null;
  readonly rowVersion: number;
  readonly memberUserIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

function mapTagRow(row: {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  colorToken: string | null;
  archivedAt: Date | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): TicketTagRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    label: row.label,
    colorToken: row.colorToken,
    archivedAt: row.archivedAt ? toIso(row.archivedAt) : null,
    rowVersion: row.rowVersion,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapQueueRow(
  row: {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    description: string | null;
    enabled: boolean;
    sortOrder: number;
    filterJson: Prisma.JsonValue;
    teamId: string | null;
    isDefault: boolean;
    archivedAt: Date | null;
    rowVersion: number;
    createdAt: Date;
    updatedAt: Date;
  },
  teamCode: string | null,
): TicketQueueRecord {
  const filterJson =
    row.filterJson !== null && typeof row.filterJson === "object" && !Array.isArray(row.filterJson)
      ? (row.filterJson as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    filterJson,
    teamId: row.teamId,
    teamCode,
    isDefault: row.isDefault,
    archivedAt: row.archivedAt ? toIso(row.archivedAt) : null,
    rowVersion: row.rowVersion,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function mapTeamRow(
  row: {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    description: string | null;
    enabled: boolean;
    isDefault: boolean;
    archivedAt: Date | null;
    rowVersion: number;
    createdAt: Date;
    updatedAt: Date;
  },
  memberUserIds: readonly string[],
): TicketTeamRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    isDefault: row.isDefault,
    archivedAt: row.archivedAt ? toIso(row.archivedAt) : null,
    rowVersion: row.rowVersion,
    memberUserIds,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export class TicketingOperationalRepository {
  async listTags(tenantId: string): Promise<readonly TicketTagRecord[]> {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.ticketTag.findMany({
        where: { tenantId },
        orderBy: [{ code: "asc" }],
      });
      return rows.map(mapTagRow);
    });
  }

  async createTag(
    tenantId: string,
    input: {
      readonly code: string;
      readonly label: string;
      readonly colorToken?: string;
    },
  ): Promise<TicketTagRecord> {
    return withTenantRls(tenantId, async (tx) => {
      const existing = await tx.ticketTag.findFirst({
        where: { tenantId, code: input.code },
        select: { id: true },
      });
      if (existing !== null) {
        throw new Error("DUPLICATE_TAG");
      }
      const row = await tx.ticketTag.create({
        data: {
          id: randomUUID(),
          tenantId,
          code: input.code,
          label: input.label,
          ...(input.colorToken !== undefined ? { colorToken: input.colorToken } : {}),
        },
      });
      return mapTagRow(row);
    });
  }

  async updateTag(
    tenantId: string,
    code: string,
    input: {
      readonly label?: string;
      readonly colorToken?: string | null;
      readonly archived?: boolean;
      readonly rowVersion: number;
    },
  ): Promise<TicketTagRecord> {
    return withTenantRls(tenantId, async (tx) => {
      const updated = await tx.ticketTag.updateMany({
        where: { tenantId, code, rowVersion: input.rowVersion },
        data: {
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.colorToken !== undefined ? { colorToken: input.colorToken } : {}),
          ...(input.archived === true ? { archivedAt: new Date() } : {}),
          ...(input.archived === false ? { archivedAt: null } : {}),
          rowVersion: input.rowVersion + 1,
        },
      });
      if (updated.count !== 1) {
        throw new Error("ROW_VERSION_CONFLICT");
      }
      const row = await tx.ticketTag.findFirst({ where: { tenantId, code } });
      if (row === null) {
        throw new Error("TAG_NOT_FOUND");
      }
      return mapTagRow(row);
    });
  }

  async listQueues(tenantId: string): Promise<readonly TicketQueueRecord[]> {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.ticketQueue.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        include: { team: { select: { code: true } } },
      });
      return rows.map((row) => mapQueueRow(row, row.team?.code ?? null));
    });
  }

  async createQueue(
    tenantId: string,
    input: {
      readonly code: string;
      readonly name: string;
      readonly description?: string;
      readonly enabled?: boolean;
      readonly sortOrder?: number;
      readonly filterJson?: Readonly<Record<string, unknown>>;
      readonly teamCode?: string;
      readonly isDefault?: boolean;
    },
  ): Promise<TicketQueueRecord> {
    return withTenantRls(tenantId, async (tx) => {
      let teamId: string | null = null;
      if (input.teamCode !== undefined) {
        const team = await tx.ticketTeam.findFirst({
          where: { tenantId, code: input.teamCode },
          select: { id: true },
        });
        if (team === null) {
          throw new Error("TEAM_NOT_FOUND");
        }
        teamId = team.id;
      }
      if (input.isDefault === true) {
        await tx.ticketQueue.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const row = await tx.ticketQueue.create({
        data: {
          id: randomUUID(),
          tenantId,
          code: input.code,
          name: input.name,
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.filterJson !== undefined
            ? { filterJson: input.filterJson as Prisma.InputJsonValue }
            : {}),
          teamId,
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        },
        include: { team: { select: { code: true } } },
      });
      return mapQueueRow(row, row.team?.code ?? null);
    });
  }

  async updateQueue(
    tenantId: string,
    code: string,
    input: {
      readonly name?: string;
      readonly description?: string | null;
      readonly enabled?: boolean;
      readonly sortOrder?: number;
      readonly filterJson?: Readonly<Record<string, unknown>>;
      readonly teamCode?: string | null;
      readonly isDefault?: boolean;
      readonly archived?: boolean;
      readonly rowVersion: number;
    },
  ): Promise<TicketQueueRecord> {
    return withTenantRls(tenantId, async (tx) => {
      let teamId: string | null | undefined;
      if (input.teamCode !== undefined) {
        if (input.teamCode === null) {
          teamId = null;
        } else {
          const team = await tx.ticketTeam.findFirst({
            where: { tenantId, code: input.teamCode },
            select: { id: true },
          });
          if (team === null) {
            throw new Error("TEAM_NOT_FOUND");
          }
          teamId = team.id;
        }
      }
      if (input.isDefault === true) {
        await tx.ticketQueue.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const updated = await tx.ticketQueue.updateMany({
        where: { tenantId, code, rowVersion: input.rowVersion },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.filterJson !== undefined
            ? { filterJson: input.filterJson as Prisma.InputJsonValue }
            : {}),
          ...(teamId !== undefined ? { teamId } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          ...(input.archived === true ? { archivedAt: new Date() } : {}),
          ...(input.archived === false ? { archivedAt: null } : {}),
          rowVersion: input.rowVersion + 1,
        },
      });
      if (updated.count !== 1) {
        throw new Error("ROW_VERSION_CONFLICT");
      }
      const row = await tx.ticketQueue.findFirst({
        where: { tenantId, code },
        include: { team: { select: { code: true } } },
      });
      if (row === null) {
        throw new Error("QUEUE_NOT_FOUND");
      }
      return mapQueueRow(row, row.team?.code ?? null);
    });
  }

  async archiveQueue(tenantId: string, code: string, rowVersion: number): Promise<TicketQueueRecord> {
    return withTenantRls(tenantId, async (tx) => {
      const queue = await tx.ticketQueue.findFirst({
        where: { tenantId, code },
        select: { id: true },
      });
      if (queue === null) {
        throw new Error("QUEUE_NOT_FOUND");
      }
      const updated = await tx.ticketQueue.updateMany({
        where: { tenantId, code, rowVersion },
        data: { archivedAt: new Date(), rowVersion: rowVersion + 1 },
      });
      if (updated.count !== 1) {
        throw new Error("ROW_VERSION_CONFLICT");
      }
      await tx.ticket.updateMany({
        where: { tenantId, queueId: queue.id },
        data: { queueId: null },
      });
      const row = await tx.ticketQueue.findFirst({
        where: { tenantId, code },
        include: { team: { select: { code: true } } },
      });
      if (row === null) {
        throw new Error("QUEUE_NOT_FOUND");
      }
      return mapQueueRow(row, row.team?.code ?? null);
    });
  }

  async listTeams(tenantId: string): Promise<readonly TicketTeamRecord[]> {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.ticketTeam.findMany({
        where: { tenantId },
        orderBy: [{ code: "asc" }],
        include: { members: { select: { userId: true } } },
      });
      return rows.map((row) =>
        mapTeamRow(row, row.members.map((member) => member.userId)),
      );
    });
  }

  async createTeam(
    tenantId: string,
    input: {
      readonly code: string;
      readonly name: string;
      readonly description?: string;
      readonly enabled?: boolean;
      readonly isDefault?: boolean;
      readonly memberUserIds?: readonly string[];
    },
  ): Promise<TicketTeamRecord> {
    return withTenantRls(tenantId, async (tx) => {
      if (input.isDefault === true) {
        await tx.ticketTeam.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const row = await tx.ticketTeam.create({
        data: {
          id: randomUUID(),
          tenantId,
          code: input.code,
          name: input.name,
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        },
      });
      const memberUserIds = input.memberUserIds ?? [];
      for (const userId of memberUserIds) {
        await tx.ticketTeamMember.create({
          data: { tenantId, teamId: row.id, userId },
        });
      }
      return mapTeamRow(row, memberUserIds);
    });
  }

  async updateTeam(
    tenantId: string,
    code: string,
    input: {
      readonly name?: string;
      readonly description?: string | null;
      readonly enabled?: boolean;
      readonly isDefault?: boolean;
      readonly archived?: boolean;
      readonly memberUserIds?: readonly string[];
      readonly rowVersion: number;
    },
  ): Promise<TicketTeamRecord> {
    return withTenantRls(tenantId, async (tx) => {
      const team = await tx.ticketTeam.findFirst({
        where: { tenantId, code },
        select: { id: true },
      });
      if (team === null) {
        throw new Error("TEAM_NOT_FOUND");
      }
      if (input.isDefault === true) {
        await tx.ticketTeam.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const updated = await tx.ticketTeam.updateMany({
        where: { tenantId, code, rowVersion: input.rowVersion },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          ...(input.archived === true ? { archivedAt: new Date() } : {}),
          ...(input.archived === false ? { archivedAt: null } : {}),
          rowVersion: input.rowVersion + 1,
        },
      });
      if (updated.count !== 1) {
        throw new Error("ROW_VERSION_CONFLICT");
      }
      if (input.memberUserIds !== undefined) {
        await tx.ticketTeamMember.deleteMany({ where: { tenantId, teamId: team.id } });
        for (const userId of input.memberUserIds) {
          await tx.ticketTeamMember.create({
            data: { tenantId, teamId: team.id, userId },
          });
        }
      }
      const row = await tx.ticketTeam.findFirst({
        where: { tenantId, code },
        include: { members: { select: { userId: true } } },
      });
      if (row === null) {
        throw new Error("TEAM_NOT_FOUND");
      }
      return mapTeamRow(row, row.members.map((member) => member.userId));
    });
  }

  async archiveTeam(tenantId: string, code: string, rowVersion: number): Promise<TicketTeamRecord> {
    return withTenantRls(tenantId, async (tx) => {
      const team = await tx.ticketTeam.findFirst({
        where: { tenantId, code },
        select: { id: true },
      });
      if (team === null) {
        throw new Error("TEAM_NOT_FOUND");
      }
      const updated = await tx.ticketTeam.updateMany({
        where: { tenantId, code, rowVersion },
        data: { archivedAt: new Date(), rowVersion: rowVersion + 1 },
      });
      if (updated.count !== 1) {
        throw new Error("ROW_VERSION_CONFLICT");
      }
      await tx.ticket.updateMany({
        where: { tenantId, assigneeTeamId: team.id },
        data: { assigneeTeamId: null },
      });
      const row = await tx.ticketTeam.findFirst({
        where: { tenantId, code },
        include: { members: { select: { userId: true } } },
      });
      if (row === null) {
        throw new Error("TEAM_NOT_FOUND");
      }
      return mapTeamRow(row, row.members.map((member) => member.userId));
    });
  }

  async findQueueByCode(tenantId: string, code: string): Promise<TicketQueueRecord | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.ticketQueue.findFirst({
        where: { tenantId, code },
        include: { team: { select: { code: true } } },
      });
      return row === null ? null : mapQueueRow(row, row.team?.code ?? null);
    });
  }

  async findTeamByCode(tenantId: string, code: string): Promise<TicketTeamRecord | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.ticketTeam.findFirst({
        where: { tenantId, code },
        include: { members: { select: { userId: true } } },
      });
      return row === null
        ? null
        : mapTeamRow(row, row.members.map((member) => member.userId));
    });
  }

  async findTagByCode(tenantId: string, code: string): Promise<TicketTagRecord | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.ticketTag.findFirst({ where: { tenantId, code } });
      return row === null ? null : mapTagRow(row);
    });
  }

  async isUserInTeam(tenantId: string, teamId: string, userId: string): Promise<boolean> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.ticketTeamMember.findFirst({
        where: { tenantId, teamId, userId },
        select: { userId: true },
      });
      return row !== null;
    });
  }

  async addTicketTag(tenantId: string, ticketId: string, tagCode: string): Promise<void> {
    return withTenantRls(tenantId, async (tx) => {
      const tag = await tx.ticketTag.findFirst({
        where: { tenantId, code: tagCode },
        select: { code: true },
      });
      if (tag === null) {
        throw new Error("TAG_NOT_FOUND");
      }
      await tx.ticketTagAssignment.create({
        data: { tenantId, ticketId, tagCode },
      });
    });
  }

  async removeTicketTag(tenantId: string, ticketId: string, tagCode: string): Promise<void> {
    return withTenantRls(tenantId, async (tx) => {
      const deleted = await tx.ticketTagAssignment.deleteMany({
        where: { tenantId, ticketId, tagCode },
      });
      if (deleted.count === 0) {
        throw new Error("TAG_NOT_FOUND");
      }
    });
  }

  async resolveQueueIdByCode(tenantId: string, code: string): Promise<string | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.ticketQueue.findFirst({
        where: { tenantId, code },
        select: { id: true },
      });
      return row?.id ?? null;
    });
  }

  async resolveTeamIdByCode(tenantId: string, code: string): Promise<string | null> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.ticketTeam.findFirst({
        where: { tenantId, code },
        select: { id: true },
      });
      return row?.id ?? null;
    });
  }
}

export function createTicketingOperationalRepository(): TicketingOperationalRepository {
  return new TicketingOperationalRepository();
}
