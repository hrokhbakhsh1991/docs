import type { Prisma } from "@prisma/client";

type TicketContext = {
  readonly requesterUserId: string;
  readonly assigneeUserId: string | null;
  readonly assigneeTeamId: string | null;
  readonly queueId: string | null;
};

type RecipientInput = {
  readonly eventType: string;
  readonly actorUserId: string | null;
  readonly ticket: TicketContext;
  readonly payload: Readonly<Record<string, unknown>>;
};

export async function resolveTicketNotificationRecipientUserIds(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: RecipientInput,
): Promise<readonly string[]> {
  const recipients = new Set<string>();
  const actorUserId = input.actorUserId?.trim() ?? null;
  const excludeActor = (userId: string | null | undefined): void => {
    if (userId === null || userId === undefined || userId.length === 0) return;
    if (actorUserId !== null && userId === actorUserId) return;
    recipients.add(userId);
  };

  const teamMemberIds = async (teamId: string | null): Promise<void> => {
    if (teamId === null) return;
    const rows = await tx.ticketTeamMember.findMany({
      where: { tenantId, teamId },
      select: { userId: true },
    });
    for (const row of rows) {
      excludeActor(row.userId);
    }
  };

  const queueTeamId = async (queueId: string | null): Promise<string | null> => {
    if (queueId === null) return null;
    const queue = await tx.ticketQueue.findFirst({
      where: { tenantId, id: queueId },
      select: { teamId: true },
    });
    return queue?.teamId ?? null;
  };

  switch (input.eventType) {
    case "ticket.created": {
      recipients.add(input.ticket.requesterUserId);
      if (input.ticket.assigneeUserId !== null) {
        excludeActor(input.ticket.assigneeUserId);
      } else {
        await teamMemberIds(input.ticket.assigneeTeamId);
        if (input.ticket.assigneeTeamId === null) {
          await teamMemberIds(await queueTeamId(input.ticket.queueId));
        }
      }
      break;
    }
    case "ticket.message.posted": {
      const authorUserId = String(
        input.payload.authorUserId ?? input.actorUserId ?? "",
      );
      const isMemberAuthor = authorUserId.length > 0 && authorUserId === input.ticket.requesterUserId;
      if (isMemberAuthor) {
        if (input.ticket.assigneeUserId !== null) {
          excludeActor(input.ticket.assigneeUserId);
        } else {
          await teamMemberIds(input.ticket.assigneeTeamId);
          if (input.ticket.assigneeTeamId === null) {
            await teamMemberIds(await queueTeamId(input.ticket.queueId));
          }
        }
      } else {
        excludeActor(input.ticket.requesterUserId);
      }
      break;
    }
    case "ticket.internal_note.created": {
      if (input.ticket.assigneeUserId !== null) {
        excludeActor(input.ticket.assigneeUserId);
      }
      await teamMemberIds(input.ticket.assigneeTeamId);
      if (input.ticket.assigneeTeamId === null) {
        await teamMemberIds(await queueTeamId(input.ticket.queueId));
      }
      break;
    }
    case "ticket.assigned": {
      const assigneeUserId =
        typeof input.payload.assigneeUserId === "string" ? input.payload.assigneeUserId : null;
      const assigneeTeamId =
        typeof input.payload.assigneeTeamId === "string"
          ? input.payload.assigneeTeamId
          : input.ticket.assigneeTeamId;
      if (assigneeUserId !== null) {
        excludeActor(assigneeUserId);
      } else {
        await teamMemberIds(assigneeTeamId);
      }
      break;
    }
    case "ticket.resolved":
      excludeActor(input.ticket.requesterUserId);
      break;
    case "ticket.reopened":
    case "ticket.status.changed":
    case "ticket.priority.changed": {
      excludeActor(input.ticket.requesterUserId);
      if (input.ticket.assigneeUserId !== null) {
        excludeActor(input.ticket.assigneeUserId);
      }
      await teamMemberIds(input.ticket.assigneeTeamId);
      break;
    }
    case "ticket.sla.warning":
    case "ticket.sla.breached":
    case "ticket.sla.escalated": {
      if (input.ticket.assigneeUserId !== null) {
        excludeActor(input.ticket.assigneeUserId);
      }
      await teamMemberIds(input.ticket.assigneeTeamId);
      if (input.ticket.assigneeTeamId === null) {
        await teamMemberIds(await queueTeamId(input.ticket.queueId));
      }
      break;
    }
    default:
      break;
  }

  return [...recipients];
}
