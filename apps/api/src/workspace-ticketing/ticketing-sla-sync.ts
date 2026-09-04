import type { Ticket } from "@app-tour/ticketing-core";

import { resolveTicketingTenantWorkspaceRow } from "./resolve-ticketing-workspace-type-for-tenant";
import {
  getTicketSlaState,
  syncTicketSlaStateForTicket,
  toTicketSlaStateHttp,
  type TicketSlaStateRecord,
} from "./ticket-sla.repository";

export async function syncTicketSlaAfterChange(
  tenantId: string,
  ticket: Ticket,
  options: {
    readonly isMemberPublicMessage?: boolean;
    readonly isOperatorPublicReply?: boolean;
    readonly nowIso?: string;
  } = {},
): Promise<TicketSlaStateRecord | null> {
  const workspace = await resolveTicketingTenantWorkspaceRow(tenantId);
  if (workspace === null) {
    return null;
  }
  return syncTicketSlaStateForTicket(tenantId, ticket.id, {
    workspaceType: workspace.workspaceType,
    categoryCode: ticket.categoryCode,
    priority: ticket.priority,
    queueId: ticket.queueId ?? null,
    status: ticket.status,
    createdAt: ticket.createdAt,
    onHold: ticket.onHold === true,
    isMemberPublicMessage: options.isMemberPublicMessage,
    isOperatorPublicReply: options.isOperatorPublicReply,
    nowIso: options.nowIso ?? new Date().toISOString(),
  });
}

export async function loadOperatorTicketSlaHttp(
  tenantId: string,
  ticketId: string,
): Promise<Record<string, unknown> | undefined> {
  const state = await getTicketSlaState(tenantId, ticketId);
  if (state === null) {
    return undefined;
  }
  return toTicketSlaStateHttp(state);
}
