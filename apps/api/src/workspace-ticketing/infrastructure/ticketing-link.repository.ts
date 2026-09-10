import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import type { TicketEvent, TicketLink, TicketLinkEntityType } from "@app-tour/ticketing-core";
import { withTenantRls } from "../../db/with-tenant-rls";
import { appendTicketingAuditEvents } from "../ticketing-audit-writer";
import { mapTicketRow, toIso } from "../ticketing-mappers";
import type { Ticket as PrismaTicket, TicketLink as PrismaTicketLink } from "@prisma/client";

export function mapLinkRow(row: PrismaTicketLink): TicketLink {
  return {
    id: row.id,
    tenantId: row.tenantId,
    ticketId: row.ticketId,
    entityType: row.entityType as TicketLinkEntityType,
    entityId: row.entityId,
    createdAt: toIso(row.createdAt),
  };
}

export class TicketingLinkRepository {
  async listByTicket(tenantId: string, ticketId: string): Promise<readonly TicketLink[]> {
    return withTenantRls(tenantId, async (tx) => {
      const rows = await tx.ticketLink.findMany({
        where: { tenantId, ticketId },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(mapLinkRow);
    });
  }

  async createLink(input: {
    readonly tenantId: string;
    readonly ticketId: string;
    readonly entityType: TicketLinkEntityType;
    readonly entityId: string;
    readonly ticket: PrismaTicket;
    readonly events: readonly TicketEvent[];
    readonly actorUserId: string | null;
  }): Promise<TicketLink> {
    return withTenantRls(input.tenantId, async (tx) => {
      try {
        const row = await tx.ticketLink.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            ticketId: input.ticketId,
            entityType: input.entityType,
            entityId: input.entityId,
          },
        });
        for (const event of input.events) {
          await tx.ticketEvent.create({
            data: {
              id: event.id,
              tenantId: event.tenantId,
              ticketId: event.ticketId,
              actorUserId: event.actorUserId,
              eventType: event.eventType,
              payload: event.payload as Prisma.InputJsonValue,
              createdAt: new Date(event.createdAt),
            },
          });
        }
        await appendTicketingAuditEvents(
          tx,
          mapTicketRow(input.ticket),
          input.events,
          input.actorUserId,
        );
        return mapLinkRow(row);
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes("uq_ticket_links_tenant_ticket_entity") ||
            error.message.includes("Unique constraint"))
        ) {
          throw new Error("TICKET_LINK_DUPLICATE");
        }
        throw error;
      }
    });
  }

  async deleteLink(input: {
    readonly tenantId: string;
    readonly ticketId: string;
    readonly linkId: string;
    readonly ticket: PrismaTicket;
    readonly events: readonly TicketEvent[];
    readonly actorUserId: string | null;
  }): Promise<void> {
    return withTenantRls(input.tenantId, async (tx) => {
      const deleted = await tx.ticketLink.deleteMany({
        where: { tenantId: input.tenantId, ticketId: input.ticketId, id: input.linkId },
      });
      if (deleted.count !== 1) {
        throw new Error("TICKET_ENTITY_NOT_FOUND");
      }
      for (const event of input.events) {
        await tx.ticketEvent.create({
          data: {
            id: event.id,
            tenantId: event.tenantId,
            ticketId: event.ticketId,
            actorUserId: event.actorUserId,
            eventType: event.eventType,
            payload: event.payload as Prisma.InputJsonValue,
            createdAt: new Date(event.createdAt),
          },
        });
      }
      await appendTicketingAuditEvents(
        tx,
        mapTicketRow(input.ticket),
        input.events,
        input.actorUserId,
      );
    });
  }
}

export function createTicketingLinkRepository(): TicketingLinkRepository {
  return new TicketingLinkRepository();
}

export class TicketingEntityValidationRepository {
  async existsTourInTenant(tenantId: string, tourId: string): Promise<boolean> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.tour.findFirst({ where: { tenantId, id: tourId }, select: { id: true } });
      return row !== null;
    });
  }

  async existsRegistrationInTenant(tenantId: string, registrationId: string): Promise<boolean> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.operatorRegistration.findFirst({
        where: { tenantId, id: registrationId },
        select: { id: true },
      });
      return row !== null;
    });
  }

  async existsPaymentInTenant(tenantId: string, paymentId: string): Promise<boolean> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.payment.findFirst({
        where: { tenantId, id: paymentId },
        select: { id: true },
      });
      return row !== null;
    });
  }

  async existsWalletInTenant(tenantId: string, walletId: string): Promise<boolean> {
    return withTenantRls(tenantId, async (tx) => {
      const row = await tx.walletAccount.findFirst({
        where: { tenantId, id: walletId },
        select: { id: true },
      });
      return row !== null;
    });
  }
}

export function createTicketingEntityValidationRepository(): TicketingEntityValidationRepository {
  return new TicketingEntityValidationRepository();
}
