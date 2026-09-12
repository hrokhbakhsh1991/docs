import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { parseTicketCodeQuery } from "@app-tour/ticketing-core";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_REQUESTER_SEARCH_MATCHES = 25;

export async function buildOperatorTicketSearchWhere(
  tx: Prisma.TransactionClient,
  tenantId: string,
  q: string | undefined,
): Promise<Prisma.TicketWhereInput | undefined> {
  const trimmed = q?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    return undefined;
  }

  const bounded = trimmed.slice(0, 200);
  const orFilters: Prisma.TicketWhereInput[] = [
    { subject: { contains: bounded, mode: "insensitive" } },
  ];

  const ticketNumber = parseTicketCodeQuery(bounded);
  if (ticketNumber !== null) {
    orFilters.push({ ticketNumber });
  }

  if (UUID_RE.test(bounded)) {
    orFilters.push({ id: bounded }, { requesterUserId: bounded });
  }

  const mobileDigits = bounded.replace(/\D/g, "");
  if (mobileDigits.length >= 4) {
    const requesters = await tx.userTenant.findMany({
      where: {
        tenantId,
        user: { mobile: { contains: mobileDigits } },
      },
      select: { userId: true },
      take: MAX_REQUESTER_SEARCH_MATCHES,
    });
    if (requesters.length > 0) {
      orFilters.push({
        requesterUserId: { in: requesters.map((row) => row.userId) },
      });
    }
  }

  return { OR: orFilters };
}

export async function allocateTicketNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<number> {
  const counter = await tx.ticketNumberCounter.upsert({
    where: { tenantId },
    create: { tenantId, nextNumber: 1 },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });
  return counter.nextNumber;
}

export async function appendTicketingSettingsAudit(input: {
  readonly tx: Prisma.TransactionClient;
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly summary: string;
}): Promise<void> {
  await input.tx.operatorSettingsAuditEvent.create({
    data: {
      id: randomUUID(),
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: "ticketing_settings.updated",
      resourceType: "ticketing_settings",
      resourceId: input.tenantId,
      summary: input.summary,
    },
  });
}
